// replicate.js

module.exports = function (RED) {
    function ReplicateConfigNode(config) {
        RED.nodes.createNode(this, config);
        // No additional code is required here as the API key is stored in credentials
    }


    function ReplicateNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Retrieve the configuration node
        const replicateConfig = RED.nodes.getNode(config.replicateConfig);

        // Retrieve API key from the configuration node's credentials
        const apiKey = replicateConfig ? replicateConfig.credentials.apiKey : null;

        node.on('input', async function (msg, send, done) {
            // Check for API Key
            if (!apiKey) {
                node.error('Missing Replicate API Key in configuration node', msg);
                node.status({ fill: 'red', shape: 'ring', text: 'Missing API Key' });
                return done();
            }

            // Prepare parameters
            let inputParams = {};

            // Merge parameters from msg.payload and node configuration
            if (typeof msg.payload === 'object' && msg.payload !== null) {
                inputParams = { ...msg.payload };
            }

            // Use node configuration as defaults
            const configParams = {
                prompt: config.prompt,
                model: config.model,
                version: config.version,
                modelType: config.modelType || 'standard', // 'standard', 'lora'
            };

            // Merge config parameters into inputParams if not already set
            for (let key in configParams) {
                if (
                    configParams[key] !== undefined &&
                    configParams[key] !== '' &&
                    !inputParams.hasOwnProperty(key)
                ) {
                    inputParams[key] = configParams[key];
                }
            }

            // Validate required parameters based on modelType
            let apiUrl = '';
            let allowedParams = [];
            let payload = { input: {} };

            if (inputParams.modelType === 'lora' || inputParams.useLoRAModel) {
                // LoRA Model
                if (!inputParams.prompt) {
                    node.error('Missing required parameter: prompt', msg);
                    node.status({ fill: 'red', shape: 'ring', text: 'Missing prompt' });
                    return done();
                }
                if (!inputParams.version) {
                    node.error('Missing required parameter: version', msg);
                    node.status({ fill: 'red', shape: 'ring', text: 'Missing version' });
                    return done();
                }

                apiUrl = 'https://api.replicate.com/v1/predictions';
                payload.version = inputParams.version;

                allowedParams = [
                    'prompt', 'image', 'mask', 'prompt_strength',
                    'num_outputs', 'num_inference_steps', 'guidance_scale',
                    'output_format', 'output_quality', 'seed', 'aspect_ratio',
                    'width', 'height', 'megapixels', 'lora_scale', 'model',
                    'extra_lora', 'extra_lora_scale', 'disable_safety_checker',
                    'go_fast'
                ];

                // Validate width and height if provided
                if (inputParams.width) {
                    const originalWidth = inputParams.width;
                    inputParams.width = Math.round(inputParams.width / 16) * 16;
                    if (inputParams.width < 256) inputParams.width = 256;
                    if (inputParams.width > 1440) inputParams.width = 1440;
                    if (originalWidth !== inputParams.width) {
                        node.warn(`Width adjusted from ${originalWidth} to ${inputParams.width} (must be multiple of 16, range: 256-1440)`, msg);
                    }
                }
                if (inputParams.height) {
                    const originalHeight = inputParams.height;
                    inputParams.height = Math.round(inputParams.height / 16) * 16;
                    if (inputParams.height < 256) inputParams.height = 256;
                    if (inputParams.height > 1440) inputParams.height = 1440;
                    if (originalHeight !== inputParams.height) {
                        node.warn(`Height adjusted from ${originalHeight} to ${inputParams.height} (must be multiple of 16, range: 256-1440)`, msg);
                    }
                }

                // Validate guidance_scale
                if (inputParams.guidance_scale !== undefined) {
                    const original = inputParams.guidance_scale;
                    inputParams.guidance_scale = Math.max(0, Math.min(10, inputParams.guidance_scale));
                    if (original !== inputParams.guidance_scale) {
                        node.warn(`Guidance scale adjusted from ${original} to ${inputParams.guidance_scale} (valid range: 0-10)`, msg);
                    }
                }

                // Validate prompt_strength
                if (inputParams.prompt_strength !== undefined) {
                    const original = inputParams.prompt_strength;
                    inputParams.prompt_strength = Math.max(0, Math.min(1, inputParams.prompt_strength));
                    if (original !== inputParams.prompt_strength) {
                        node.warn(`Prompt strength adjusted from ${original} to ${inputParams.prompt_strength} (valid range: 0-1)`, msg);
                    }
                }

                // Validate lora_scale and extra_lora_scale
                ['lora_scale', 'extra_lora_scale'].forEach(param => {
                    if (inputParams[param] !== undefined) {
                        const original = inputParams[param];
                        inputParams[param] = Math.max(-1, Math.min(3, inputParams[param]));
                        if (original !== inputParams[param]) {
                            node.warn(`${param} adjusted from ${original} to ${inputParams[param]} (valid range: -1 to 3)`, msg);
                        }
                    }
                });

                // Validate num_outputs
                if (inputParams.num_outputs) {
                    const original = inputParams.num_outputs;
                    inputParams.num_outputs = Math.max(1, Math.min(4, inputParams.num_outputs));
                    if (original !== inputParams.num_outputs) {
                        node.warn(`num_outputs adjusted from ${original} to ${inputParams.num_outputs} (valid range: 1-4)`, msg);
                    }
                }

                // Validate num_inference_steps
                if (inputParams.num_inference_steps) {
                    const original = inputParams.num_inference_steps;
                    inputParams.num_inference_steps = Math.max(1, Math.min(50, inputParams.num_inference_steps));
                    if (original !== inputParams.num_inference_steps) {
                        node.warn(`num_inference_steps adjusted from ${original} to ${inputParams.num_inference_steps} (valid range: 1-50, recommended: 28)`, msg);
                    }
                }

                // Validate output_quality
                if (inputParams.output_quality) {
                    const original = inputParams.output_quality;
                    inputParams.output_quality = Math.max(0, Math.min(100, inputParams.output_quality));
                    if (original !== inputParams.output_quality) {
                        node.warn(`output_quality adjusted from ${original} to ${inputParams.output_quality} (valid range: 0-100)`, msg);
                    }
                }

                // Validate output_format
                if (inputParams.output_format && !['webp', 'jpg', 'png'].includes(inputParams.output_format)) {
                    const original = inputParams.output_format;
                    inputParams.output_format = 'webp';  // Default to webp if invalid
                    node.warn(`Invalid output format '${original}' defaulting to 'webp' (valid values: 'webp', 'jpg', 'png')`, msg);
                }

                // Validate megapixels
                if (inputParams.megapixels && !['1', '0.25'].includes(inputParams.megapixels)) {
                    const original = inputParams.megapixels;
                    inputParams.megapixels = '1';  // Default to 1 if invalid
                    node.warn(`Invalid megapixels value '${original}' defaulting to '1' (valid values: '1', '0.25')`, msg);
                }

                // Validate model type
                if (inputParams.model && !['dev', 'schnell'].includes(inputParams.model)) {
                    const original = inputParams.model;
                    inputParams.model = 'dev';  // Default to dev if invalid
                    node.warn(`Invalid model value '${original}' defaulting to 'dev' (valid values: 'dev', 'schnell')`, msg);
                }

            } else if (inputParams.modelType === 'redux' ||
                (inputParams.model && inputParams.model.toLowerCase().includes('flux-redux-dev'))) {
                // FLUX Redux Dev Model
                if (!inputParams.redux_image || inputParams.redux_image === '') {
                    node.error('FLUX Redux models require a redux_image parameter. This should be a URL or base64 image.', msg);
                    node.status({ fill: 'red', shape: 'ring', text: 'Missing redux_image' });
                    return done();
                }

                apiUrl = 'https://api.replicate.com/v1/models/black-forest-labs/flux-redux-dev/predictions';

                // Remove any prompt parameter as it's not used by Redux models
                delete inputParams.prompt;

                apiUrl = 'https://api.replicate.com/v1/models/black-forest-labs/flux-redux-dev/predictions';

                allowedParams = [
                    'redux_image', 'guidance', 'megapixels', 'num_outputs',
                    'aspect_ratio', 'output_format', 'output_quality',
                    'num_inference_steps', 'seed', 'disable_safety_checker'
                ];

                // Validate guidance
                if (inputParams.guidance !== undefined) {
                    const original = inputParams.guidance;
                    inputParams.guidance = Math.max(0, Math.min(10, inputParams.guidance));
                    if (original !== inputParams.guidance) {
                        node.warn(`Guidance adjusted from ${original} to ${inputParams.guidance} (valid range: 0-10)`, msg);
                    }
                }

                // Validate num_outputs
                if (inputParams.num_outputs) {
                    const original = inputParams.num_outputs;
                    inputParams.num_outputs = Math.max(1, Math.min(4, inputParams.num_outputs));
                    if (original !== inputParams.num_outputs) {
                        node.warn(`num_outputs adjusted from ${original} to ${inputParams.num_outputs} (valid range: 1-4)`, msg);
                    }
                }

                // Validate num_inference_steps
                if (inputParams.num_inference_steps) {
                    const original = inputParams.num_inference_steps;
                    inputParams.num_inference_steps = Math.max(1, Math.min(50, inputParams.num_inference_steps));
                    if (original !== inputParams.num_inference_steps) {
                        node.warn(`num_inference_steps adjusted from ${original} to ${inputParams.num_inference_steps} (valid range: 1-50, recommended: 28-50)`, msg);
                    }
                }

                // Validate output_quality
                if (inputParams.output_quality) {
                    const original = inputParams.output_quality;
                    inputParams.output_quality = Math.max(0, Math.min(100, inputParams.output_quality));
                    if (original !== inputParams.output_quality) {
                        node.warn(`output_quality adjusted from ${original} to ${inputParams.output_quality} (valid range: 0-100)`, msg);
                    }
                }

                // Validate output_format
                if (inputParams.output_format && !['webp', 'jpg', 'png'].includes(inputParams.output_format)) {
                    const original = inputParams.output_format;
                    inputParams.output_format = 'webp';  // Default to webp if invalid
                    node.warn(`Invalid output format '${original}' defaulting to 'webp' (valid values: 'webp', 'jpg', 'png')`, msg);
                }

                // Validate megapixels
                if (inputParams.megapixels && !['1', '0.25'].includes(inputParams.megapixels)) {
                    const original = inputParams.megapixels;
                    inputParams.megapixels = '1';  // Default to 1 if invalid
                    node.warn(`Invalid megapixels value '${original}' defaulting to '1' (valid values: '1', '0.25')`, msg);
                }


            } else if (inputParams.model && inputParams.model.toLowerCase().includes('flux-redux-schnell')) {
                // FLUX Redux Schnell Model
                if (!inputParams.redux_image || inputParams.redux_image === '') {
                    node.error('FLUX Redux Schnell models require a redux_image parameter. This should be a URL or base64 image.', msg);
                    node.status({ fill: 'red', shape: 'ring', text: 'Missing redux_image' });
                    return done();
                }

                apiUrl = `https://api.replicate.com/v1/models/${inputParams.model}/predictions`;

                delete inputParams.prompt;

                allowedParams = [
                    'redux_image', 'aspect_ratio', 'num_outputs', 'num_inference_steps',
                    'seed', 'output_format', 'output_quality', 'disable_safety_checker',
                    'megapixels'
                ];

                // Validate num_outputs
                if (inputParams.num_outputs) {
                    const original = inputParams.num_outputs;
                    inputParams.num_outputs = Math.max(1, Math.min(4, inputParams.num_outputs));
                    if (original !== inputParams.num_outputs) {
                        node.warn(`num_outputs adjusted from ${original} to ${inputParams.num_outputs} (valid range: 1-4)`, msg);
                    }
                }

                // Validate num_inference_steps
                if (inputParams.num_inference_steps) {
                    const original = inputParams.num_inference_steps;
                    inputParams.num_inference_steps = Math.max(1, Math.min(4, inputParams.num_inference_steps));
                    if (original !== inputParams.num_inference_steps) {
                        node.warn(`num_inference_steps adjusted from ${original} to ${inputParams.num_inference_steps} (valid range: 1-4)`, msg);
                    }
                }

                // Validate output_quality
                if (inputParams.output_quality) {
                    const original = inputParams.output_quality;
                    inputParams.output_quality = Math.max(0, Math.min(100, inputParams.output_quality));
                    if (original !== inputParams.output_quality) {
                        node.warn(`output_quality adjusted from ${original} to ${inputParams.output_quality} (valid range: 0-100)`, msg);
                    }
                }

                // Validate output_format
                if (inputParams.output_format && !['webp', 'jpg', 'png'].includes(inputParams.output_format)) {
                    const original = inputParams.output_format;
                    inputParams.output_format = 'webp';  // Default to webp if invalid
                    node.warn(`Invalid output format '${original}' defaulting to 'webp' (valid values: 'webp', 'jpg', 'png')`, msg);
                }

                // Validate megapixels
                if (inputParams.megapixels && !['1', '0.25'].includes(inputParams.megapixels)) {
                    const original = inputParams.megapixels;
                    inputParams.megapixels = '1';  // Default to 1 if invalid
                    node.warn(`Invalid megapixels value '${original}' defaulting to '1' (valid values: '1', '0.25')`, msg);
                }

            } else if (inputParams.model && inputParams.model.toLowerCase().includes('flux-1.1-pro-ultra')) {
                // FLUX Pro Ultra Model
                if (!inputParams.prompt) {
                    node.error('Missing required parameter: prompt', msg);
                    node.status({ fill: 'red', shape: 'ring', text: 'Missing prompt' });
                    return done();
                }

                apiUrl = `https://api.replicate.com/v1/models/${inputParams.model}/predictions`;

                allowedParams = [
                    'prompt', 'image_prompt', 'image_prompt_strength', 'aspect_ratio',
                    'safety_tolerance', 'seed', 'raw', 'output_format'
                ];

                // Validate safety_tolerance
                if (inputParams.safety_tolerance) {
                    const originalTolerance = inputParams.safety_tolerance;
                    inputParams.safety_tolerance = Math.max(1, Math.min(6, inputParams.safety_tolerance));
                    if (originalTolerance !== inputParams.safety_tolerance) {
                        node.warn(`Safety tolerance adjusted from ${originalTolerance} to ${inputParams.safety_tolerance} (valid range: 1-6)`, msg);
                    }
                }

                // Validate image_prompt_strength
                if (inputParams.image_prompt_strength !== undefined) {
                    const originalStrength = inputParams.image_prompt_strength;
                    inputParams.image_prompt_strength = Math.max(0, Math.min(1, inputParams.image_prompt_strength));
                    if (originalStrength !== inputParams.image_prompt_strength) {
                        node.warn(`Image prompt strength adjusted from ${originalStrength} to ${inputParams.image_prompt_strength} (valid range: 0-1)`, msg);
                    }
                }

                // Validate output_format
                if (inputParams.output_format && !['jpg', 'png'].includes(inputParams.output_format)) {
                    const originalFormat = inputParams.output_format;
                    inputParams.output_format = 'jpg';  // Default to jpg if invalid
                    node.warn(`Invalid output format '${originalFormat}' defaulting to 'jpg' (valid values: 'jpg', 'png')`, msg);
                }

                // Set default raw if not specified
                if (inputParams.raw === undefined) {
                    inputParams.raw = false;
                }

            } else if (inputParams.model && inputParams.model.toLowerCase().includes('flux-1.1-pro')) {
                // FLUX Pro Model
                if (!inputParams.prompt) {
                    node.error('Missing required parameter: prompt', msg);
                    node.status({ fill: 'red', shape: 'ring', text: 'Missing prompt' });
                    return done();
                }

                apiUrl = `https://api.replicate.com/v1/models/${inputParams.model}/predictions`;

                allowedParams = [
                    'prompt', 'image_prompt', 'aspect_ratio', 'width', 'height',
                    'safety_tolerance', 'seed', 'prompt_upsampling',
                    'output_format', 'output_quality'
                ];

                // Validate width and height if provided
                if (inputParams.width) {
                    const originalWidth = inputParams.width;
                    inputParams.width = Math.round(inputParams.width / 32) * 32;
                    if (inputParams.width < 256) inputParams.width = 256;
                    if (inputParams.width > 1440) inputParams.width = 1440;
                    if (originalWidth !== inputParams.width) {
                        node.warn(`Width adjusted from ${originalWidth} to ${inputParams.width} (must be multiple of 32, range: 256-1440)`, msg);
                    }
                }
                if (inputParams.height) {
                    const originalHeight = inputParams.height;
                    inputParams.height = Math.round(inputParams.height / 32) * 32;
                    if (inputParams.height < 256) inputParams.height = 256;
                    if (inputParams.height > 1440) inputParams.height = 1440;
                    if (originalHeight !== inputParams.height) {
                        node.warn(`Height adjusted from ${originalHeight} to ${inputParams.height} (must be multiple of 32, range: 256-1440)`, msg);
                    }
                }

                // Validate safety_tolerance
                if (inputParams.safety_tolerance) {
                    const originalTolerance = inputParams.safety_tolerance;
                    inputParams.safety_tolerance = Math.max(1, Math.min(6, inputParams.safety_tolerance));
                    if (originalTolerance !== inputParams.safety_tolerance) {
                        node.warn(`Safety tolerance adjusted from ${originalTolerance} to ${inputParams.safety_tolerance} (valid range: 1-6)`, msg);
                    }
                }

                // Validate output_quality
                if (inputParams.output_quality) {
                    const originalQuality = inputParams.output_quality;
                    inputParams.output_quality = Math.max(0, Math.min(100, inputParams.output_quality));
                    if (originalQuality !== inputParams.output_quality) {
                        node.warn(`Output quality adjusted from ${originalQuality} to ${inputParams.output_quality} (valid range: 0-100)`, msg);
                    }
                }

            } else if (inputParams.model && inputParams.model.toLowerCase().includes('flux-schnell')) {
                // FLUX Schnell Model
                if (!inputParams.prompt) {
                    node.error('Missing required parameter: prompt', msg);
                    node.status({ fill: 'red', shape: 'ring', text: 'Missing prompt' });
                    return done();
                }

                apiUrl = `https://api.replicate.com/v1/models/${inputParams.model}/predictions`;

                allowedParams = [
                    'prompt', 'aspect_ratio', 'num_outputs', 'num_inference_steps',
                    'seed', 'output_format', 'output_quality', 'disable_safety_checker',
                    'go_fast', 'megapixels'
                ];

                if (inputParams.num_outputs) {
                    const original = inputParams.num_outputs;
                    inputParams.num_outputs = Math.max(1, Math.min(4, inputParams.num_outputs));
                    if (original !== inputParams.num_outputs) {
                        node.warn(`num_outputs adjusted from ${original} to ${inputParams.num_outputs} (valid range: 1-4)`, msg);
                    }
                }

                // Validate num_inference_steps
                if (inputParams.num_inference_steps) {
                    const original = inputParams.num_inference_steps;
                    inputParams.num_inference_steps = Math.max(1, Math.min(4, inputParams.num_inference_steps));
                    if (original !== inputParams.num_inference_steps) {
                        node.warn(`num_inference_steps adjusted from ${original} to ${inputParams.num_inference_steps} (valid range: 1-4)`, msg);
                    }
                }

                // Validate output_quality
                if (inputParams.output_quality) {
                    const original = inputParams.output_quality;
                    inputParams.output_quality = Math.max(0, Math.min(100, inputParams.output_quality));
                    if (original !== inputParams.output_quality) {
                        node.warn(`output_quality adjusted from ${original} to ${inputParams.output_quality} (valid range: 0-100)`, msg);
                    }
                }

                // Validate megapixels
                if (inputParams.megapixels && !['1', '0.25'].includes(inputParams.megapixels)) {
                    const original = inputParams.megapixels;
                    inputParams.megapixels = '1';
                    node.warn(`Invalid megapixels value '${original}' defaulting to '1' (valid values: '1', '0.25')`, msg);
                }

                // Set default go_fast if not specified
                if (inputParams.go_fast === undefined) {
                    inputParams.go_fast = true;
                }

            } else {
                // Standard Base Model
                if (!inputParams.prompt) {
                    node.error('Missing required parameter: prompt', msg);
                    node.status({ fill: 'red', shape: 'ring', text: 'Missing prompt' });
                    return done();
                }
                if (!inputParams.model) {
                    node.error('Missing required parameter: model', msg);
                    node.status({ fill: 'red', shape: 'ring', text: 'Missing model' });
                    return done();
                }

                apiUrl = `https://api.replicate.com/v1/models/${inputParams.model}/predictions`;

                allowedParams = [
                    'prompt', 'num_outputs', 'num_inference_steps', 'guidance_scale',
                    'output_format', 'output_quality', 'seed', 'aspect_ratio',
                    'width', 'height', 'megapixels', 'disable_safety_checker',
                    'go_fast'
                ];
            }

            // Build the 'input' object with allowed parameters
            allowedParams.forEach(param => {
                const value = inputParams[param];
                if (value !== undefined && value !== null && value !== '') {
                    payload.input[param] = value;
                }
            });

            // Handle 'image', 'mask', and 'redux_image' parameters
            const imageParams = ['image', 'mask', 'redux_image'];
            for (let paramName of imageParams) {
                if (payload.input[paramName]) {
                    payload.input[paramName] = await processImageParam(payload.input[paramName], node, msg, paramName);
                    if (!payload.input[paramName]) {
                        // Error has been handled in processImageParam
                        return done();
                    }
                }
            }

            // Dynamic import of 'got' library
            let got;
            try {
                ({ got } = await import('got'));
            } catch (error) {
                node.error('Failed to import "got" library. Ensure it is installed.', msg);
                node.status({ fill: 'red', shape: 'ring', text: 'Import error' });
                return done();
            }

            try {
                node.status({ fill: 'blue', shape: 'dot', text: 'Requesting...' });

                // Make the initial API request
                const initialResponse = await got.post(apiUrl, {
                    json: payload,
                    headers: {
                        'Authorization': `Token ${apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    responseType: 'json',
                    throwHttpErrors: false,
                });

                if (initialResponse.statusCode === 422) {
                    node.error(`API returned a 422 error: ${JSON.stringify(initialResponse.body, null, 2)}`, msg);
                    node.status({ fill: 'red', shape: 'ring', text: 'API 422 Error' });
                    return done();
                } else if (initialResponse.statusCode !== 201) {
                    node.error(`API returned an error: ${initialResponse.statusCode} - ${JSON.stringify(initialResponse.body, null, 2)}`, msg);
                    node.status({ fill: 'red', shape: 'ring', text: `API Error ${initialResponse.statusCode}` });
                    return done();
                }

                let prediction = initialResponse.body;

                // Polling loop to check the status
                const pollingInterval = 2000; // in milliseconds
                const maxPollingTime = 300000; // Timeout after 5 minutes
                const startTime = Date.now();

                node.status({ fill: 'yellow', shape: 'dot', text: 'Processing...' });

                while (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
                    // Wait for the specified interval
                    await new Promise(resolve => setTimeout(resolve, pollingInterval));

                    // Check if polling has exceeded the max time
                    if (Date.now() - startTime > maxPollingTime) {
                        throw new Error('Polling timed out.');
                    }

                    // Make a GET request to check the status
                    const statusResponse = await got.get(prediction.urls.get, {
                        headers: {
                            'Authorization': `Token ${apiKey}`,
                        },
                        responseType: 'json',
                    });

                    prediction = statusResponse.body;
                }

                if (prediction.status === 'succeeded') {
                    // Normalize the output to always be an array of URLs
                    const outputUrls = Array.isArray(prediction.output)
                        ? prediction.output
                        : [prediction.output];

                    msg.payload = {
                        output: outputUrls,  // Array of image URLs
                        original_output: prediction.output,
                        logs: prediction.logs,
                        metrics: prediction.metrics,
                        id: prediction.id,
                        status: prediction.status,
                        created_at: prediction.created_at,
                        completed_at: prediction.completed_at,
                    };
                    node.status({ fill: 'green', shape: 'dot', text: 'Completed' });
                    send(msg);
                    done();
                } else {
                    // Image generation failed
                    node.status({ fill: 'red', shape: 'ring', text: 'Failed' });
                    node.error(`Prediction failed: ${prediction.error || 'Unknown error'}`, msg);
                    done();
                }
            } catch (error) {
                node.status({ fill: 'red', shape: 'ring', text: 'Error' });
                node.error('Request failed: ' + error.message, msg);
                done();
            }

            // Function to process image parameters
            async function processImageParam(param, node, msg, paramName) {
                if (Buffer.isBuffer(param)) {
                    // Convert Buffer to base64 string
                    const base64Image = `data:image/png;base64,${param.toString('base64')}`;
                    return base64Image;
                } else if (typeof param === 'string') {
                    if (param.startsWith('data:')) {
                        // Assume it's already a data URI
                        return param;
                    } else if (/^https?:\/\//i.test(param)) {
                        // For 'redux_image', it expects a URL, so return as is
                        if (paramName === 'redux_image') {
                            return param;
                        }
                        // If it's a URL, fetch and convert it to base64
                        try {
                            node.status({ fill: 'blue', shape: 'dot', text: `Fetching ${paramName}` });
                            let response = await fetch(param);
                            // Use response.arrayBuffer() instead of response.buffer()
                            let arrayBuffer = await response.arrayBuffer();
                            const buffer = Buffer.from(arrayBuffer);
                            const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
                            return base64Image;
                        } catch (err) {
                            node.error(`Failed to fetch ${paramName} from URL: ${err.message}`, msg);
                            node.status({ fill: 'red', shape: 'ring', text: `Error fetching ${paramName}` });
                            return null;
                        }
                    } else {
                        // Assume it's a file path
                        try {
                            const fs = require('fs');
                            const buffer = fs.readFileSync(param);
                            const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
                            return base64Image;
                        } catch (err) {
                            node.error(`Failed to read ${paramName} from file: ${err.message}`, msg);
                            node.status({ fill: 'red', shape: 'ring', text: `Error reading ${paramName}` });
                            return null;
                        }
                    }
                } else {
                    node.error(`Invalid ${paramName} format. Must be a Buffer, URL, or file path string.`, msg);
                    node.status({ fill: 'red', shape: 'ring', text: `Invalid ${paramName}` });
                    return null;
                }
            }
        });
    }

    // Register the node without credentials
    RED.nodes.registerType('replicate-config', ReplicateConfigNode, {
        credentials: {
            apiKey: { type: 'password' }
        }
    });
    RED.nodes.registerType('replicate-node', ReplicateNode);

};
