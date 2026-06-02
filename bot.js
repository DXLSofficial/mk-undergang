const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const admin = require('firebase-admin');
const puppeteer = require('puppeteer');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Esto crea una web falsa. Render pensará que es una app normal y no la tumbará.
app.get('/', (req, res) => {
    res.send('🤖 Marcador MK Activo 24/7');
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor de mantenimiento escuchando en puerto ${PORT}`);
});

// 1. CONFIGURACIÓN DE FIREBASE
const serviceAccount = require("./firebase.json"); 
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://mariokart-live-default-rtdb.firebaseio.com"
});
const db = admin.database();

// 2. CONFIGURACIÓN DE DISCORD
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const TOKEN_DISCORD = "MTUxMTMzNTg3ODUwNzYzMDY4NA.GN1_uW.YAmeRBuGHCkNh8Ua2zsdIzk04HYDBT2sgLhN2I"; 
const CANAL_ID = "1511345155574075442"; 

let ID_MENSAJE_MARCADOR = null; 
let estaProcesando = false; 

const URL_DE_LA_WEB = "https://dxlsofficial.github.io/mk-undergang/"; 

client.once('ready', () => {
    console.log(`🤖 Bot conectado como ${client.user.tag}`);
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
            browser = await puppeteer.launch({ 
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox'] 
            });
            const page = await browser.newPage();
            
            // Aumentamos ligeramente el viewport base para soportar cómodamente el zoom
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

            // --- PASO ACTUALIZADO: ZOOM Y OCULTAR BOTÓN ADMIN ---
            console.log("🛠️ [3/5] Aplicando zoom y limpiando interfaz de captura...");
            await page.evaluate(() => {
                // 1. Quitar el botón flotante "Modo Admin" usando su ID real
                const botonAdmin = document.getElementById('btn-candado');
                if (botonAdmin) botonAdmin.remove();

                // 2. Por seguridad, eliminar también el panel de gestión si estuviese abierto
                const panelGestion = document.getElementById('panel-gestion-root');
                if (panelGestion) panelGestion.remove();

                // 3. Aplicar zoom del 120% a la estructura principal
                document.body.style.zoom = "1.2";
            });

            console.log("📸 [4/5] Esperando renderizado y capturando...");
            await new Promise(r => setTimeout(r, 2000));
            
            // Buscamos la tabla con la clase .container de tu estructura HTML
            const elementoTabla = await page.$('.container') || await page.$('#tabla-body');
            const imagenBuffer = elementoTabla 
                ? await elementoTabla.screenshot({ type: 'png' }) 
                : await page.screenshot({ type: 'png' });

            console.log("🚀 [5/5] Subiendo a Discord...");
            const canal = await client.channels.fetch(CANAL_ID);
            const attachment = new AttachmentBuilder(imagenBuffer, { name: 'marcador.png' });

            if (ID_MENSAJE_MARCADOR) {
                const msg = await canal.messages.fetch(ID_MENSAJE_MARCADOR);
                await msg.edit({ files: [attachment] });
            } else {
                const nuevoMsg = await canal.send({ files: [attachment] });
                ID_MENSAJE_MARCADOR = nuevoMsg.id;
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

client.login(TOKEN_DISCORD);