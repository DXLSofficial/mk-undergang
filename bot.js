const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const admin = require('firebase-admin');
const puppeteer = require('puppeteer');

// 1. CONFIGURACIÓN DE FIREBASE (Lee el archivo secreto que pondremos en Render)
const serviceAccount = require("./firebase.json"); 
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mariokart-live-default-rtdb.firebaseio.com"
});
const db = admin.database();

// 2. CONFIGURACIÓN DE DISCORD
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const CANAL_ID = "1511345155574075442"; 
let ID_MENSAJE_MARCADOR = null; 
let estaProcesando = false; 
const URL_DE_LA_WEB = "https://dxlsofficial.github.io/mk-undergang/"; 

client.once('ready', async () => {
    console.log(`🤖 Bot conectado como ${client.user.tag}`);
    
    // Recupera el ID del mensaje para no repetir imágenes
    try {
        const snapshot = await db.ref('configuracion/discord_message_id').once('value');
        if (snapshot.exists()) {
            ID_MENSAJE_MARCADOR = snapshot.val();
            console.log(`📌 ID de mensaje recuperado de Firebase: ${ID_MENSAJE_MARCADOR}`);
        }
    } catch (e) {
        console.error("No se pudo leer el ID del mensaje:", e.message);
    }

    conectarFirebaseConDiscord();
});

function conectarFirebaseConDiscord() {
    db.ref('jugadores').on('value', async (snapshot) => {
        if (estaProcesando) return;
        estaProcesando = true;

        console.log("\n⚡ [1/5] Cambio detectado. Iniciando Puppeteer...");
        let browser;

        const timeoutRescale = setTimeout(async () => {
            if (estaProcesando) {
                console.error("⚠️ [TIMEOUT] Forzando liberación...");
                estaProcesando = false;
                if (browser) try { await browser.close(); } catch(e) {}
            }
        }, 26000);

        try {
            // ARGUMENTOS OBLIGATORIOS PARA EL NAVEGADOR EN INTERNET (RENDER)
            browser = await puppeteer.launch({ 
                headless: "new",
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process'
                ] 
            });
            const page = await browser.newPage();
            
            await page.setViewport({ width: 1200, height: 950, deviceScaleFactor: 2 });
            await page.goto(URL_DE_LA_WEB, { waitUntil: 'networkidle2', timeout: 30000 });

            console.log("🔑 [2/5] Verificando acceso...");
            const selectorInput = 'input[type="password"]';
            const input = await page.$(selectorInput);
            
            if (input) {
                console.log("🔒 Muro detectado. Inyectando contraseña...");
                await page.evaluate((selector, pass) => {
                    const field = document.querySelector(selector);
                    field.value = pass;
                    field.dispatchEvent(new Event('input', { bubbles: true }));
                    const btn = document.querySelector('button') || document.querySelector('input[type="submit"]');
                    if (btn) btn.click();
                }, selectorInput, "mariokartwii"); 
                
                await new Promise(r => setTimeout(r, 4000));
            }

            console.log("🛠️ [3/5] Aplicando zoom y limpiando interfaz...");
            await page.evaluate(() => {
                const botonAdmin = document.getElementById('btn-candado');
                if (botonAdmin) botonAdmin.remove();

                const panelGestion = document.getElementById('panel-gestion-root');
                if (panelGestion) panelGestion.remove();

                document.body.style.zoom = "1.2";
            });

            console.log("📸 [4/5] Capturando pantalla...");
            await new Promise(r => setTimeout(r, 2000));
            
            const elementoTabla = await page.$('.container') || await page.$('#tabla-body');
            const imagenBuffer = elementoTabla 
                ? await elementoTabla.screenshot({ type: 'png' }) 
                : await page.screenshot({ type: 'png' });

            console.log("🚀 [5/5] Subiendo a Discord...");
            const canal = await client.channels.fetch(CANAL_ID);
            const attachment = new AttachmentBuilder(imagenBuffer, { name: 'marcador.png' });

            if (ID_MENSAJE_MARCADOR) {
                try {
                    const msg = await canal.messages.fetch(ID_MENSAJE_MARCADOR);
                    await msg.edit({ files: [attachment] });
                    console.log("✅ Mensaje editado con éxito.");
                } catch (errFetch) {
                    const nuevoMsg = await canal.send({ files: [attachment] });
                    ID_MENSAJE_MARCADOR = nuevoMsg.id;
                    await db.ref('configuracion/discord_message_id').set(nuevoMsg.id);
                }
            } else {
                const nuevoMsg = await canal.send({ files: [attachment] });
                ID_MENSAJE_MARCADOR = nuevoMsg.id;
                await db.ref('configuracion/discord_message_id').set(nuevoMsg.id);
                console.log("✅ Nuevo mensaje enviado y guardado.");
            }
            
            console.log("✅ Ciclo terminado.");

        } catch (err) {
            console.error("❌ Error:", err.message);
        } finally {
            clearTimeout(timeoutRescale);
            if (browser) await browser.close();
            estaProcesando = false;
        }
    });
}

// PROTECCIÓN FINAL: El token se lee desde las variables de Render
client.login(process.env.DISCORD_TOKEN);