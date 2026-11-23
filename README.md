# Abdallah Jabr — Portfolio

A static portfolio site with a built-in admin page. Plain HTML, CSS and JavaScript, no build step, hosted on **GitHub Pages**.

```
index.html            Home page
work.html             All work
project.html          Case study page (project.html?p=<slug>)
admin.html            Admin editor (saves straight to this repo through the GitHub API)
404.html              Not-found page
data/projects.json    Projects
data/experience.json  Experience, learning and recognition
data/content.json     Edited page text
data/site.json        Photos, links, CV and screens gallery
assets/css/style.css  Styles (colour palette at the top: :root = dark, [data-theme="light"] = light)
assets/js/            config.js (owner/repo/branch only) · core.js · home.js · project.js · fx.js · admin.js …
assets/uploads/       Images and files uploaded from the admin page
sitemap.xml           Rebuilt by the admin page whenever projects change
```

## Editing

Open `admin.html`, paste the editor key, edit, then **Publish**. The site updates in about a minute. Every save is a normal commit, so anything can be undone from the commit history.

**Important:** this repository is public. "Hidden" only hides an item on the website — its text stays readable in `data/*.json` and in the git history. Don't put anything private in the admin.

## Editor key (GitHub token)

Use a **fine-grained** token limited to this one repository:

- Repository access → **Only select repositories** → this repo
- Permissions → **Contents: Read and write** (nothing else)
- Set an **expiry date**

The key stays only in your browser; it is never stored in the code. Tick "Remember" only on your own device. If a device is lost, revoke the token on GitHub. To switch keys, open `admin.html?lock`.

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
