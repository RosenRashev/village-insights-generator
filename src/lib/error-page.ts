export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="bg">
  <head>
    <meta charset="utf-8" />
    <title>Страницата не се зареди — Къде Да</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fff; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      img { width: 72px; height: 72px; }
      h1 { font-size: 1.25rem; margin: 1rem 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #0f7a3d; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <img src="/logo-icon.png" alt="Къде Да" width="72" height="72" />
      <h1>Страницата не се зареди</h1>
      <p>Нещо се обърка от наша страна. Опитайте да презаредите или се върнете в началото.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Опитай отново</button>
        <a class="secondary" href="/">Към началото</a>
      </div>
    </div>
  </body>
</html>`;
}
