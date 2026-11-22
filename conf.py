import asyncio, json, subprocess, time, sys
srv=subprocess.Popen(['python3','-m','http.server','8812'],cwd='/home/claude/abdallahjabr47.github.io',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(1)
R='/home/claude/abdallahjabr47.github.io/'
async def gh(route, req):
    u=req.url
    if u.endswith('/repos/a/p'): return await route.fulfill(status=200, content_type='application/json', body=json.dumps({'permissions':{'push':True}}))
    for k in ['projects.json','experience.json','content.json','site.json']:
        if k in u: return await route.fulfill(status=200, body=open(R+'data/'+k).read())
    return await route.fulfill(status=404, body='{}')
from playwright.async_api import async_playwright
async def m():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); errs=[]
        pg=await b.new_page(viewport={'width':1280,'height':900}); pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
        await pg.route('https://api.github.com/**', gh)
        await pg.goto('http://localhost:8812/admin.html'); await pg.wait_for_timeout(500)
        await pg.evaluate("document.getElementById('lg-owner').value='a';document.getElementById('lg-repo').value='p'"); await pg.fill('#lg-token','x')
        await pg.click('#loginForm button[type=submit]'); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelector('#pageTabs [data-page=work]').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#subTabs [data-sub=projects]').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelectorAll('#plist [data-a=edit]')[5].click()"); await pg.wait_for_timeout(1000)
        await pg.evaluate("document.querySelectorAll('#edForm > fieldset').forEach(f=>f.classList.remove('fs-shut'))")
        async def test(sel, name, count_sel):
            before=await pg.evaluate(f"document.querySelectorAll('{count_sel}').length")
            await pg.evaluate(f"document.querySelector('{sel}').click()"); await pg.wait_for_timeout(300)
            dlg=await pg.evaluate("(()=>{const d=document.querySelector('dialog[open]');return d?d.innerText.replace(/\\s+/g,' ').slice(0,80):null})()")
            if name=='shot': await pg.screenshot(path='confirm.png')
            await pg.evaluate("(()=>{const d=document.querySelector('dialog[open]');if(d){const b=[...d.querySelectorAll('button')].find(b=>/Cancel/.test(b.textContent));b&&b.click()}})()"); await pg.wait_for_timeout(200)
            after=await pg.evaluate(f"document.querySelectorAll('{count_sel}').length")
            print(name, 'dialog:',dlg, 'kept' if before==after else 'REMOVED', before, after)
        await test('[data-dr-del]','demo step','[data-demo-row]')
        await test('[data-dr-clear]','clear taps','.dr-dot')
        await test('.dr-dot','tap dot','.dr-dot')
        await test('.imgs .im [data-im=del]','shot','.imgs .im')
        await test('.ri [data-del-row]','ri card','.ri')
        print(errs or 'ok'); await b.close()
asyncio.run(m()); srv.terminate()
