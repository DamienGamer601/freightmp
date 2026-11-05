import http from "node:http";
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    console.log(`[RECU] ${req.method} ${req.url} event=${req.headers["x-fmp-event"]} sig=${String(req.headers["x-fmp-signature"]).slice(0, 24)}...`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
}).listen(4999, () => console.log("recepteur pret sur 4999"));
