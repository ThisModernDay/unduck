# Unduck

> **Enhanced Fork**: This fork adds several improvements to the original [Unduck by Theo](https://github.com/t3dotgg/unduck):
> - Search history with filtering options (1h, 24h, week, all)
> - Custom bangs management
> - Improved UI with modals and animations
> - Better error handling and validation
> - Local-first approach with IndexedDB storage
> - Configurable base URL through environment variables

## Original Project

This project is a fork of [Unduck](https://github.com/t3dotgg/unduck) created by [Theo Browne](https://github.com/t3dotgg). The original project provides a fast, local-first solution for DuckDuckGo bang redirects. All core functionality and the brilliant idea behind this project are credited to Theo.

## Overview

DuckDuckGo's bang redirects are too slow. Add the following URL as a custom search engine to your browser. Enables all of DuckDuckGo's bangs to work, but much faster.

```
https://unduck.thismodern.dev/?q=%s
```

## How is it that much faster?

DuckDuckGo does their redirects server side. Their DNS is...not always great. Result is that it often takes ages.

I solved this by doing all of the work client side. Once you've went to https://unduck.thismodern.dev once, the JS is all cache'd and will never need to be downloaded again. Your device does the redirects, not me.

## Deployment

### Docker

The application can be deployed using Docker. We provide both a Dockerfile and docker-compose.yml for easy deployment.

#### Using Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/ThisModernDay/unduck.git
cd unduck
```

2. Start the container:
```bash
docker-compose up -d
```

The application will be available at http://localhost.

#### Using Docker Directly

1. Build the image:
```bash
docker build -t unduck .
```

2. Run the container:
```bash
docker run -d -p 80:80 unduck
```

### Configuration

The default configuration serves the application on port 80. To use a different port, modify the `ports` section in `docker-compose.yml` or adjust the `-p` flag in the docker run command.

#### Environment Variables

- `VITE_BASE_URL`: The base URL where the application is hosted (default: https://unduck.thismodern.dev)

You can set this environment variable in different ways:

1. Using Docker Compose:
```bash
VITE_BASE_URL=https://your-domain.com docker-compose up -d
```

2. Using Docker directly:
```bash
docker build --build-arg VITE_BASE_URL=https://your-domain.com -t unduck .
docker run -d -p 80:80 unduck
```

3. Using a .env file:
```env
VITE_BASE_URL=https://your-domain.com
```

4. For Vercel deployment:
Add `VITE_BASE_URL` in your project's environment variables through the Vercel dashboard.

## Credits

- Original project: [Unduck](https://github.com/t3dotgg/unduck) by [Theo Browne](https://github.com/t3dotgg)
- Enhanced version by [ThisModernDay](https://github.com/ThisModernDay)
