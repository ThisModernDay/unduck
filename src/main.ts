import { bangs } from "./bang";

const defaultBang = bangs.find((b) => b.t === "g");

function getBangredirectUrl() {
  const url = new URL(window.location.href);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) return null;

  const match = query.match(/!([a-z]+)/i);

  const bangCandidate = match?.[1]?.toLowerCase();
  const selectedBang = bangs.find((b) => b.t === bangCandidate) ?? defaultBang;

  // Remove the first bang from the query
  const cleanQuery = query.replace(/![a-z]+\s*/i, "").trim();

  // Format of the url is:
  // https://www.google.com/search?q={{{s}}}
  const searchUrl = selectedBang?.u.replace(
    "{{{s}}}",
    encodeURIComponent(cleanQuery)
  );
  if (!searchUrl) return null;

  return searchUrl;
}

const searchUrl = getBangredirectUrl() ?? "https://www.google.com";

window.location.replace(searchUrl);
