const puppeteer = require('puppeteer');
const axios = require('axios');

// ==============================================================================
// 1. CONFIGURACIÓN PRINCIPAL Y MEMORIA
// ==============================================================================
const URL_WEXAIT = "https://wexait.com/api/v1/actualizar-inventario-secreto";
const TOKEN_SECRETO = "WexaitBot2026_Admin";

const URL_LOGIN_MAYFLUX = "https://mayflux.com/login";
const CORREO_PROVEEDOR = "Univedson1@gmail.com";
const CONTRASENA_PROVEEDOR = "Univedson1@gmail.com"; // <-- RECUERDA PONER TU CLAVE REAL

// Memoria global para guardar los strikes de protección entre cada escaneo
const MEMORIA_VIGILANTE = {};

const PRODUCTOS_A_VIGILAR = [
    {
        id_wexait: 5,
        nombre: "AMAZON PRIME VIDEO PANTALLA (30 Dias)",
        url_proveedor: "https://mayflux.com/product/amazon-prime-video-pantalla-1"
    },
    {
        id_wexait: 19,
        nombre: "DISNEY+ Estándar PANTALLA (30 Dias)",
        url_proveedor: "https://mayflux.com/product/disney-pantalla-premium-sin-espn"
    },
    {
        id_wexait: 18,
        nombre: "DISNEY+ PREMIUM PANTALLA - Espn (30 Dias)",
        url_proveedor: "https://mayflux.com/product/disney-pantalla-premium-espn-1"
    },
    {
        id_wexait: 7,
        nombre: "VIX PREMIUM PANTALLA (30 Dias)",
        url_proveedor: "https://mayflux.com/product/vix-premium-pantalla-1"
    },
    {
        id_wexait: 10,
        nombre: "PLEX PREMIUM PANTALLA (30 Dias)",
        url_proveedor: "https://mayflux.com/product/plex-pantalla-licencia-premium"
    },
    {
        id_wexait: 6,
        nombre: "PARAMOUNT+ PANTALLA ESTANDAR (30 Dias)",
        url_proveedor: "https://mayflux.com/product/paramount-pantalla-plan-premium"
    },
    {
        id_wexait: 84,
        nombre: "PARAMOUNT+ PANTALLA PREMIUM (30 Dias)",
        url_proveedor: "https://mayflux.com/product/paramount-pantalla-plan-premium"
    },
    {
        id_wexait: 11,
        nombre: "UNIVERSAL+ PANTALLA (30 Dias)",
        url_proveedor: "https://mayflux.com/product/universal-pantalla-con-anuncios-no-sirve-en-roku"
    },
    {
        id_wexait: 12,
        nombre: "APPLE TV+ PANTALLA (30 Dias)",
        url_proveedor: "https://mayflux.com/product/apple-tv-pantalla-no-sirve-en-mac-ios"
    },
    {
        id_wexait: 20,
        nombre: "DEEZER PREMIUM - 1 DISPOSITIVO (30 Dias)",
        url_proveedor: "https://mayflux.com/product/deezer-premium"
    },
    {
        id_wexait: 21,
        nombre: "SPOTIFY PREMIUM (13 Días)",
        url_proveedor: "https://mayflux.com/product/spotify-sin-anuncios-13-14-dias-1"
    },
    {
        id_wexait: 3,
        nombre: "CRUNCHYROLL PANTALLA (30 Dias)",
        url_proveedor: "https://mayflux.com/product/crunchyroll-pantalla-megafan"
    },
    {
        id_wexait: 83,
        nombre: "WIN+ PLAY (30 Dias)",
        url_proveedor: "https://mayflux.com/product/win-solo-colombia-1-disp-1"
    },
    {
        id_wexait: 103,
        nombre: "IPTV ESTANDAR PANTALLA (30 Dias)",
        url_proveedor: "https://mayflux.com/product/iptv-pantalla-1"
    },
    {
        id_wexait: 90,
        nombre: "VIX COMPLETA(30 Dias)",
        url_proveedor: "https://mayflux.com/product/vix-premium-completa-1"
    },
     {
        id_wexait: 99,
        nombre: "XUPER TV PANTALLA(30 Dias)",
        url_proveedor: "https://mayflux.com/product/xuper-tv-pantalla-solo-android-flujo-tv-1"
    },
    {
        id_wexait: 13,
        nombre: "MUBI PANTALLA (30 Dias)",
        url_proveedor: "https://mayflux.com/product/mubi-pantalla"
    },
    {
        id_wexait: 22,
        nombre: "SPOTIFY PREMIUM - 1 DISPOSITIVO (30 Dias)",
        url_proveedor: "https://mayflux.com/product/spotify-premium"
    },
    {
        id_wexait: 4,
        nombre: "HBO MAX PANTALLA(30 Dias)",
        url_proveedor: "https://mayflux.com/product/max-pantalla-sin-anuncios"
    }
];

// 🔥 FUNCIÓN MODIFICADA: Ahora recibe y envía 'cantidad_stock' 🔥
async function actualizarProductoWexait(producto_id, hay_stock, cantidad_stock, nombre_referencia) {
    const estado_api = hay_stock ? 1 : 0;
    try {
        const params = new URLSearchParams();
        params.append('id', producto_id);
        params.append('status', estado_api);
        params.append('stock', cantidad_stock); // <-- AQUÍ SE EMPACA EL NÚMERO
        params.append('token', TOKEN_SECRETO);

        const res = await axios.post(URL_WEXAIT, params);
        if (res.status === 200) {
            const accion = hay_stock ? `🟢 DISPONIBLE (Stock enviado: ${cantidad_stock})` : "🔴 AGOTADO (OFF)";
            console.log(`[*] Wexait sincronizado: ${nombre_referencia} -> ${accion}`);
        }
    } catch (error) {
        console.log(`[!] Error de conexión con la API de Wexait para el producto ID ${producto_id}`);
    }
}

// ==============================================================================
// 2. MOTOR DE SCRAPING 
// ==============================================================================
async function verificarStockProveedor() {
    console.log("\n[+] Iniciando inspección de inventario en Mayflux con Puppeteer...");
    let browser;
    try {
        // 🔥 CORRECCIÓN DE MEMORIA APLICADA AQUÍ 🔥
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-first-run',
                '--no-zygote',
                '--single-process'
            ]
        });
        const page = await browser.newPage();
        
        await page.setDefaultNavigationTimeout(60000); 

        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

        // --- 1. LOGIN ---
        try {
            console.log("[*] Entrando a Mayflux...");
            await page.goto(URL_LOGIN_MAYFLUX, { waitUntil: 'networkidle2', timeout: 60000 });
            
            const emailInput = await page.$('input[type="email"]');
            const passInput = await page.$('input[type="password"]');
            
            if (emailInput && passInput) {
                await page.type('input[type="email"]', CORREO_PROVEEDOR);
                await page.type('input[type="password"]', CONTRASENA_PROVEEDOR);
                await Promise.all([
                    page.click('button[type="submit"]'),
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {})
                ]);
                console.log("✅ Sesión iniciada.");
            }
        } catch (err) {
            console.log("[?] Omitiendo login (interfaz pre-cargada o acceso directo permitido).");
        }

        // --- 2. NAVEGAR Y VERIFICAR CADA PRODUCTO ---
        for (const prod of PRODUCTOS_A_VIGILAR) {
            console.log(`\n🚀 Iniciando MISIÓN DE VIGILANCIA para: ${prod.nombre}`);
            try {
                await page.goto(prod.url_proveedor, { waitUntil: 'networkidle2', timeout: 60000 });
                console.log("✅ Producto cargado.");
                
                await new Promise(r => setTimeout(r, 5000));

                const resultadoScraping = await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const btnCarrito = btns.find(b => b.innerText && b.innerText.toLowerCase().includes('carrito'));
                    
                    let isBtnDisabled = false;
                    if (btnCarrito) {
                        isBtnDisabled = btnCarrito.disabled;
                    }

                    const spans = Array.from(document.querySelectorAll('span'));
                    const spanStock = spans.find(s => s.innerText && s.innerText.toLowerCase().includes('stock'));
                    
                    let numeroStock = 0;
                    if (spanStock) {
                        const match = spanStock.innerText.match(/\d+/);
                        if (match) {
                            numeroStock = parseInt(match[0], 10);
                        }
                    }

                    let estado = 'agotado'; 
                    
                    if (btnCarrito && !isBtnDisabled && numeroStock > 0) {
                        estado = 'disponible';
                    }

                    let diasDetectados = null;
                    const spanDias = spans.find(s => s.innerText && s.innerText.toLowerCase().match(/\d+\s*d[íi]as?/i));
                    if (spanDias) {
                        const matchDias = spanDias.innerText.match(/(\d+)/);
                        if (matchDias) {
                            diasDetectados = parseInt(matchDias[0], 10);
                        }
                    }

                    return { estado, diasDetectados, stockLeido: numeroStock };
                });

                let hayStock = (resultadoScraping.estado === 'disponible');
                console.log(`[🔍] Diagnóstico: Stock leído = ${resultadoScraping.stockLeido}, Días detectados = ${resultadoScraping.diasDetectados}`);

                // ============================================================
                // 🛡️ SISTEMA DE PROTECCIÓN DE MARGEN (STRIKES)
                // ============================================================
                const matchEsperados = prod.nombre.match(/(\d+)\s*d[íi]as?/i);
                const diasEsperados = matchEsperados ? parseInt(matchEsperados[1], 10) : null;

                if (!MEMORIA_VIGILANTE[prod.id_wexait]) MEMORIA_VIGILANTE[prod.id_wexait] = { strikes: 0 };
                const memoria = MEMORIA_VIGILANTE[prod.id_wexait];

                if (hayStock && resultadoScraping.diasDetectados && diasEsperados) {
                    if (resultadoScraping.diasDetectados > diasEsperados) {
                        memoria.strikes++;
                        if (memoria.strikes >= 2) {
                            hayStock = false; 
                            console.log(`🛡️ ESCUDO ACTIVADO: La web dice ${resultadoScraping.diasDetectados} días (Tú esperas: ${diasEsperados}). Forzando a AGOTADO para proteger margen.`);
                        } else {
                            console.log(`⚠️ ALERTA: Posible cambio a ${resultadoScraping.diasDetectados} días. Strike ${memoria.strikes}/2.`);
                        }
                    } else {
                        memoria.strikes = 0; 
                    }
                } else if (!hayStock) {
                    memoria.strikes = 0; 
                }
                // ============================================================

                if (!hayStock && memoria.strikes < 2) {
                    console.log("⚠️ Producto detectado como AGOTADO en Mayflux.");
                } else if (hayStock) {
                    console.log("🛒 Producto con stock disponible.");
                }

                // 🔥 LÍNEA MODIFICADA: Le pasamos 'resultadoScraping.stockLeido' a la función 🔥
                await actualizarProductoWexait(prod.id_wexait, hayStock, resultadoScraping.stockLeido, prod.nombre);

            } catch (error) {
                console.log(`[!] Error al inspeccionar ${prod.nombre}: ${error.message}`);
            }
            
            await new Promise(r => setTimeout(r, 2000));
        }

    } catch (error) {
        console.error("❌ Error General de Puppeteer:", error.message);
    } finally {
        if (browser) {
            await browser.close();
            console.log("[*] Navegador cerrado para mantener el servidor optimizado.");
        }
    }
}

// ==============================================================================
// 3. BUCLE DE TIEMPO 
// ==============================================================================
function obtenerHoraColombia() {
    const ahora = new Date();
    const opciones = { timeZone: 'America/Bogota', hour: 'numeric', hour12: false };
    const formateador = new Intl.DateTimeFormat('en-US', opciones);
    return parseInt(formateador.format(ahora), 10);
}

async function iniciarVigilancia() {
    console.log("=======================================================");
    console.log("🚀 BOT VIGÍA (CON ESCUDO DE PROTECCIÓN) INICIADO");
    console.log("=======================================================");

    while (true) {
        const horaActual = obtenerHoraColombia();
        
        if (horaActual >= 8) {
            await verificarStockProveedor();
            console.log("[*] Misión terminada. Esperando 45 minutos para el siguiente escaneo...");
            await new Promise(r => setTimeout(r, 2700000)); // 45 minutos
        } else {
            console.log("[Noche COP] Horario inactivo. Bot en reposo nocturno (12 AM - 8 AM).");
            await new Promise(r => setTimeout(r, 900000)); 
        }
    }
}

iniciarVigilancia();
