import { bangs } from "./bang";

const defaultBang = bangs.find((b) => b.t === "g");

function doBangRedirect() {
  const url = new URL(window.location.href);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) return null;
  const match = query.match(/!([a-z]+)/i);
  if (!match) return null;
  const bangCandidate = match[1].toLowerCase();
  const selectedBang = bangs.find((b) => b.t === bangCandidate) ?? defaultBang;

  return selectedBang;
}

const bang = doBangRedirect();
if (bang) {
  console.log("bang", bang);

  // window.location.replace(bang.d + "?q=" + encodeURIComponent(query));
}

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1>T3 Search</h1>
  </div>
`;

setupCounter(document.querySelector<HTMLButtonElement>("#counter")!);
