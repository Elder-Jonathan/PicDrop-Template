# PicDrop-Template

## Overview
PicDrop is an NFC-based photo sharing app that integrates with Dropbox, allowing users to easily share photos by simply scanning NFC tags.

## Features
- Efficient photo sharing through NFC technology
- Seamless integration with Dropbox
- User-friendly interface

## Installation
1. Clone the repository:
    ```
git clone https://github.com/yourusername/picdrop-template.git
    ```
2. Navigate to the project directory:
    ```
cd picdrop-template
    ```

3. Install the necessary dependencies:
    ```
npm install
    ```

## Usage
- Follow the on-screen instructions to share photos via NFC.
    
## Configuration
- Update the configurations in the `config.json` file to set your Dropbox API keys.

### GitHub Actions Dropbox secret setup
`update-gallery.yml` now supports **either** a single JSON secret **or** separate secrets.

#### Option A (recommended): one secret with all API values
1. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
2. Create secret name: `DROPBOX_CONFIG_JSON`.
3. Paste JSON in this format:
   ```json
   {
     "appKey": "YOUR_DROPBOX_APP_KEY",
     "appSecret": "YOUR_DROPBOX_APP_SECRET",
     "refreshToken": "YOUR_DROPBOX_REFRESH_TOKEN",
     "accessToken": "YOUR_DROPBOX_ACCESS_TOKEN",
     "folderPath": "/PicDropUploads"
   }
   ```

#### Option B: separate secrets
- `DROPBOX_APP_KEY`
- `DROPBOX_APP_SECRET`
- `DROPBOX_REFRESH_TOKEN`
- `DROPBOX_ACCESS_TOKEN` (optional; useful for quick testing, but Dropbox access tokens expire)
- `DROPBOX_APP_KEY` + `DROPBOX_APP_SECRET` + `DROPBOX_REFRESH_TOKEN` are recommended for reliable scheduled runs (workflow auto-refreshes access tokens)
- `DROPBOX_FOLDER_PATH` (optional; defaults to `/PicDropUploads`)

For local testing, copy `Product1/dropbox-config.example.json` to `Product1/dropbox-config.json` and fill values. The script reads that file automatically when env vars/secrets are not set.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Authors
- Elder-Jonathan
