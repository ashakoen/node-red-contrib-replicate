# node-red-contrib-replicate

![Node-RED Replicate Flow Example](node-red-replicate.png)

A Node-RED node for generating images using the Replicate API. This node supports various Replicate models, including standard base models and LoRA fine-tuned models.

## Prerequisites

- Node-RED installation
- Replicate API key (get one at [replicate.com](https://replicate.com))

## Installation

Either use the Editor - Menu - Manage Palette - Install option, or run the following npm command in your Node-RED user directory (typically `~/.node-red`):
```
npm i node-red-contrib-replicate
```

### Manual Installation

1. **Download the Code**:
   - Clone the repository or download the ZIP file from GitHub.

   ```
   git clone https://github.com/ashakoen/node-red-contrib-replicate.git
   ```

2. **Navigate to the Node-RED User Directory**:
   - Typically, this is located at `~/.node-red`.

   ```
   cd ~/.node-red
   ```

3. **Copy the Node Files**:
   - Copy the downloaded files into the `~/.node-red` directory.

4. **Install Dependencies**:
   - Run the following command to install the necessary dependencies.

   ```
   npm install ./node-red-contrib-replicate
   ```

5. **Restart Node-RED**:
   - Restart your Node-RED instance to load the new node.

## Features

- Support for standard Replicate models and LoRA fine-tuned models
- Automatic parameter validation and adjustment
- Supports image inputs via URL, file path, or base64 data
- Comprehensive error handling and status feedback
- Configurable output formats (webp, jpg, png)
- Support for various model-specific parameters
- Include config node for secure storage of Replicate API key
- Image preview functionality inspired by [node-red-contrib-image-output](https://github.com/rikukissa/node-red-contrib-image-output) by [@rikukissa](https://github.com/rikukissa)

## Usage

1. Add your Replicate API key in the configuration node.
2. Choose your model type (Standard or LoRA).
3. Configure model-specific parameters.
4. Send input via msg.payload.

### Input Parameters

The node accepts parameters via the node configuration or ```msg.payload```. Parameters in ```msg.payload``` override node configuration.

Common parameters include:
- ```prompt``` - Text description of the desired image
- ```num_outputs``` - Number of images to generate (1-4)
- ```num_inference_steps``` - Number of denoising steps
- ```guidance_scale``` - How closely to follow the prompt (0-10)
- ```aspect_ratio``` - Image aspect ratio (e.g., "1:1", "16:9")
- ```output_format``` - Image format ("webp", "jpg", "png")
- ```seed``` - Random seed for reproducible results

### Output

The node outputs a ```msg.payload``` object containing:
- ```output``` - Array of generated image URLs
- ```original_output``` - Original API response
- ```logs``` - Generation process logs
- ```metrics``` - Performance metrics
- ```id``` - Prediction ID
- ```status``` - Final status
- ```created_at``` - Creation timestamp
- ```completed_at``` - Completion timestamp

## Example Flow

```
[
  {
    "id": "1ad8eec921654237",
    "type": "tab",
    "label": "Replicate",
    "disabled": false,
    "info": "",
    "env": []
  },
  {
    "id": "96bd7d88790b2536",
    "type": "inject",
    "z": "1ad8eec921654237",
    "name": "",
    "props": [
      {
        "p": "payload"
      }
    ],
    "repeat": "",
    "crontab": "",
    "once": false,
    "onceDelay": 0.1,
    "topic": "",
    "payload": "{\"prompt\":\"a fast racecar\",\"num_outputs\":1,\"guidance_scale\":5,\"num_inference_steps\":35,\"model\":\"black-forest-labs/flux-dev\",\"useLoRAModel\":false,\"image\":\"\",\"mask\":\"\",\"prompt_strength\":0.8,\"format\":\"png\",\"aspect_ratio\":\"4:5\"}",
    "payloadType": "json",
    "x": 650,
    "y": 380,
    "wires": [
      [
        "34302b79787f7c6e"
      ]
    ]
  },
  {
    "id": "34302b79787f7c6e",
    "type": "replicate-node",
    "z": "1ad8eec921654237",
    "name": "",
    "replicateConfig": "de8b4314b35b9d1e",
    "modelType": "standard",
    "prompt": "",
    "model": "",
    "version": "",
    "showPreview": true,
    "previewWidth": "200",
    "x": 820,
    "y": 380,
    "wires": [
      []
    ]
  },
  {
    "id": "de8b4314b35b9d1e",
    "type": "replicate-config"
  }
]
```

## Supported Models

### Standard Models
- FLUX Dev
- FLUX Pro
- FLUX Pro Ultra
- FLUX Schnell
- Other Replicate-compatible models

### LoRA Models
- Any LoRA fine-tuned model on Replicate

## Error Handling

The node provides detailed error messages and status updates for:
- Missing required parameters
- Invalid parameter values
- API errors
- Network issues
- Image processing errors

## License

MIT

## Support

For issues and feature requests, please use the GitHub issue tracker.

## Contributing

Contributions are welcome! Please submit pull requests or open issues for any improvements.