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
        id_wexait: 18,
        nombre: "DISNEY+ PREMIUM PANTALLA - Espn (30 Dias)",
        url_proveedor: "https://mayflux.com/product/disney-pantalla-premium-espn"
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
        id_wexait: 39,
        nombre: "CAPCUT PRO 1 DISP (30 Dias)",
        url_proveedor: "https://mayflux.com/product/capcut-pro-1-disp-no-sirve-en-iphone"
    },
    {
        id_wexait: 42,
        nombre: "AVIRA ANTIVIRUS 5DISP (90 Dias)",
        url_proveedor: "https://mayflux.com/product/avira-antivirus-5disp-3m"
    },
    {
        id_wexait: 46,
        nombre: "NORDVPN 1 DISP (30 Dias)",
        url_proveedor: "https://mayflux.com/product/nordvpn-1-disp"
    },
    {
        id_wexait: 47,
        nombre: "VPN HMA 1 DISP (30 Dias)",
        url_proveedor: "https://mayflux.com/product/vpn-hma-1-disp-1"
    },
    {
        id_wexait: 3,
        nombre: "CRUNCHYROLL PANTALLA (30 Dias)",
        url_proveedor: "https://mayflux.com/product/crunchyroll-pantalla-megafan"
    },
    {
        id_wexait: 4,
        nombre: "HBO MAX PANTALLA(30 Dias)",
        url_proveedor: "https://mayflux.com/product/max-pantalla-sin-anuncios-1"
    }
];

// Función silenciosa para sincronizar el estado en tu base de datos de Laravel
async function actualizarProductoWexait(producto_id, hay_stock, nombre_referencia) {
    const estado_api = hay_stock ? 1 : 0;
    try {
        const params = new URLSearchParams();
        params.append('id', producto_id);
        params.append('status', estado_api);
        params.append('token', TOKEN_SECRETO);

        const res = await axios.post(URL_WEXAIT, params);
        if (res.status === 200) {
            const accion = hay_stock ? "🟢 DISPONIBLE" : "🔴 AGOTADO (OFF)";
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
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

        // --- 1. LOGIN ---
        try {
            console.log("[*] Entrando a Mayflux...");
            await page.goto(URL_LOGIN_MAYFLUX, { waitUntil: 'networkidle2', timeout: 30000 });
            
            const emailInput = await page.$('input[type="email"]');
            const passInput = await page.$('input[type="password"]');
            
            if (emailInput && passInput) {
                await page.type('input[type="email"]', CORREO_PROVEEDOR);
                await page.type('input[type="password"]', CONTRASENA_PROVEEDOR);
                await Promise.all([
                    page.click('button[type="submit"]'),
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {})
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
                await page.goto(prod.url_proveedor, { waitUntil: 'networkidle2', timeout: 40000 });
                console.log("✅ Producto cargado.");
                
                await new Promise(r => setTimeout(r, 3000));

                // 🕵️‍♂️ VERIFICAR ESTADO Y DÍAS EN PANTALLA
                const resultadoScraping = await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const btnCarrito = btns.find(b => b.innerText.toLowerCase().includes('añadir al carrito'));
                    const textoPagina = document.body.innerText.toLowerCase();

                    let estado = 'disponible';

                    // Regla original
                    if (!btnCarrito || textoPagina.includes('agotado') || textoPagina.includes('out of stock')) {
                        estado = 'agotado';
                    }

                    // 2da revisión de stock
                    if (estado === 'agotado') {
                        const matchStock = textoPagina.match(/stock\s*:?\s*(\d+)/);
                        if (matchStock) {
                            const numeroStock = parseInt(matchStock[1], 10);
                            if (numeroStock > 0) {
                                estado = 'disponible';
                            }
                        }
                    }

                    // LECTOR DE TIEMPO (DÍAS) PARA EL ESCUDO
                    let diasDetectados = null;
                    // Intenta buscar el número de días justo antes de la palabra "stock"
                    const matchDiasCercaStock = textoPagina.match(/(\d+)\s*d[íi]as?[\s\S]{0,30}?stock/i);
                    if (matchDiasCercaStock) {
                        diasDetectados = parseInt(matchDiasCercaStock[1], 10);
                    } else {
                        // Respaldo: el primer número de días que aparezca
                        const matchDiasGeneral = textoPagina.match(/(\d+)\s*d[íi]as?/i);
                        if (matchDiasGeneral) {
                            diasDetectados = parseInt(matchDiasGeneral[1], 10);
                        }
                    }

                    return { estado, diasDetectados };
                });

                let hayStock = (resultadoScraping.estado === 'disponible');

                // ============================================================
                // 🛡️ SISTEMA DE PROTECCIÓN DE MARGEN (STRIKES)
                // ============================================================
                // Extraemos cuántos días esperas tú (del nombre de tu producto)
                const matchEsperados = prod.nombre.match(/(\d+)\s*d[íi]as?/i);
                const diasEsperados = matchEsperados ? parseInt(matchEsperados[1], 10) : null;

                // Preparamos la memoria del bot para este producto
                if (!MEMORIA_VIGILANTE[prod.id_wexait]) MEMORIA_VIGILANTE[prod.id_wexait] = { strikes: 0 };
                const memoria = MEMORIA_VIGILANTE[prod.id_wexait];

                if (hayStock && resultadoScraping.diasDetectados && diasEsperados) {
                    // Si el proveedor subió los días (ej. de 30 a 60, lo que significa más caro)
                    if (resultadoScraping.diasDetectados > diasEsperados) {
                        memoria.strikes++;
                        if (memoria.strikes >= 2) {
                            hayStock = false; // Activamos el escudo, lo forzamos a apagado
                            console.log(`🛡️ ESCUDO ACTIVADO: La web dice ${resultadoScraping.diasDetectados} días (Tú esperas: ${diasEsperados}). Forzando a AGOTADO para proteger margen.`);
                        } else {
                            console.log(`⚠️ ALERTA: Posible cambio a ${resultadoScraping.diasDetectados} días. Strike ${memoria.strikes}/2.`);
                        }
                    } else {
                        memoria.strikes = 0; // Todo normal, borramos strikes
                    }
                } else if (!hayStock) {
                    memoria.strikes = 0; // Si se agotó naturalmente, reseteamos memoria
                }
                // ============================================================

                if (!hayStock && memoria.strikes < 2) {
                    console.log("⚠️ Producto detectado como AGOTADO en Mayflux.");
                } else if (hayStock) {
                    console.log("🛒 Producto con stock disponible.");
                }

                // Disparamos la actualización a tu web
                await actualizarProductoWexait(prod.id_wexait, hayStock, prod.nombre);

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
