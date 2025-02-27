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
