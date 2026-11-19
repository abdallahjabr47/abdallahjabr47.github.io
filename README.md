# Abdallah Jabr — Portfolio

A fast, static portfolio site with a built-in admin page. It uses plain HTML, CSS and JavaScript, so there is no build step. It's hosted free on **GitHub Pages**.

```
index.html          Home page
project.html        Case study page (project.html#redz, project.html#momyt-meet …)
admin.html          Admin dashboard: add, edit, reorder, hide and delete projects
data/projects.json  All project content (the admin page edits this file for you)
data/experience.json  Your work history (also edited from the admin page)
assets/css/         Styles
assets/js/          config.js (settings) · core.js · home.js · project.js · admin.js
assets/img/         Your photos (profile.jpg, profile-2.jpg)
assets/uploads/     Images uploaded from the admin page
assets/cv.pdf       Your résumé (the "View My CV" button opens it; replace the file to update it)
```

---

## 1. Put it live on GitHub Pages (about 5 minutes)

1. Create a GitHub account if you don't have one.
2. Create a **new repository**:
   - Name it **`YOUR-USERNAME.github.io`** if you want the site at `https://YOUR-USERNAME.github.io`.
   - Or use any name, like `portfolio`, and the site will be at `https://YOUR-USERNAME.github.io/portfolio`.
   - Make it **Public**.
3. Upload all the files in this folder to the repository.
   - Easiest way: on the repo page, click **Add file → Upload files**, drag the *contents* of this folder in, then click **Commit changes**.
   - Or use the command line:
     ```bash
     git init && git add . && git commit -m "Portfolio"
     git branch -M main
     git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
     git push -u origin main
     ```
4. In the repo, go to **Settings → Pages → Build and deployment**. Set Source to **Deploy from a branch**, Branch to **main**, and Folder to **/ (root)**, then click **Save**.
5. Wait about 1 minute. The address of your site appears at the top of the Pages settings.

**Custom domain (optional):** buy a domain (for example, `abdallahjabr.com`). Add it under **Settings → Pages → Custom domain**, then follow GitHub's DNS instructions.

---

## 2. Set up the admin page (once)

1. Open `assets/js/config.js` and fill in your GitHub username, your repo name and your branch (`main`). Commit the change.
2. Create a GitHub token that can only edit this repo:
   - Go to GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - Under Repository access, choose **Only select repositories** and select your portfolio repo.
   - Under Permissions → Repository permissions, set **Contents** to **Read and write**.
   - Generate the token and copy it.
3. Open `https://your-site/admin.html`, paste the token and sign in.

The token is stored only in your browser. Never put it in the code. If you lose your laptop, delete the token on GitHub.

## 3. Add a new project (every time)

1. Go to **admin.html** and click **+ New project**.
2. Fill in the name, one-liner, category and status, and choose the type: Mobile app, Website, or both.
3. Upload images:
   - the app icon
   - phone screenshots (these are what visitors swipe through on the card)
   - website screenshots if the project has a website
   - the gallery for the case study ("After", plus "Before" if it was a redesign)

   Images are resized and compressed automatically.
4. Write the story: overview, problem, responsibilities, process steps, challenges and solutions, results, and what you learned.

   **Empty sections are hidden automatically**, so a small project can stay short.
5. Click **Preview changes** (or **Preview site** on the list page) to see exactly how it will look. A yellow bar shows you're in preview mode. Nothing goes live and nobody else can see it.
6. When you're happy, click **Publish to site**. Your site updates in about one minute.

You can also reorder projects (↑ ↓), hide them without deleting them, or delete them.

## Experience

Open the **Experience** tab in the admin page. From there you can add a role, edit it (title, company, dates, summary and highlights), reorder roles, or **Hide** one to keep it saved but off the website.

Roles that are currently hidden:

- Cincy Labs
- Gaza Sky Geeks
- Palestine EdTech Hub
- Paltel Group Foundation

## Colours and fonts

The colour palette lives at the top of `assets/css/style.css` (`:root` for dark mode, `[data-theme="light"]` for light mode). Change a colour there and it updates across the whole site.

## Light and dark mode

The site follows the visitor's system setting by default. The sun/moon button in the top bar switches it, and the choice is remembered.

---

## Editing other content

These parts of the home page live in `index.html` (hero, About, Experience, Services, FAQ, contact links). Search the file for `[` to find every placeholder you still need to fill in:

- **Photos:** save them as `assets/img/profile.jpg` (hero) and `assets/img/profile-2.jpg` (About).
- **CV:** save it as `assets/cv.pdf`.
- **Contact links:** your email and WhatsApp come from your résumé. Add your LinkedIn link in the `#contact` section.

## Preview on your computer

Pages load project data with `fetch`, so opening the HTML file directly won't show projects. Run a tiny local server from this folder instead:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Why there's no database

GitHub stores everything: your project text in `data/projects.json` and images in `assets/uploads/`. This setup:

- is free
- never "sleeps"
- keeps a full history of every change, so you can undo anything from the repo's commit history
- needs no server to maintain
