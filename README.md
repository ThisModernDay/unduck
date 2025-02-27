# Unduck

> **Enhanced Fork**: This fork adds several improvements to the original Unduck:
> - Search history with filtering options (1h, 24h, week, all)
> - Custom bangs management
> - Improved UI with modals and animations
> - Better error handling and validation
> - Local-first approach with IndexedDB storage

DuckDuckGo's bang redirects are too slow. Add the following URL as a custom search engine to your browser. Enables all of DuckDuckGo's bangs to work, but much faster.

```
https://unduck.thismodern.dev/?q=%s
```

## How is it that much faster?

DuckDuckGo does their redirects server side. Their DNS is...not always great. Result is that it often takes ages.

I solved this by doing all of the work client side. Once you've went to https://unduck.thismodern.dev once, the JS is all cache'd and will never need to be downloaded again. Your device does the redirects, not me.

## Self-Hosting

### URL Configuration

When self-hosting, you'll need to update the URL in the code to match your domain. Edit the URL in `src/main.ts`:

```typescript
<input
  type="text"
  class="url-input"
  value="https://your-domain.com/?q=%s"
  readonly
/>
```

Replace `your-domain.com` with your actual domain where you'll be hosting the service.

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
