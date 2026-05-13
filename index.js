const puppeteer = require('puppeteer');
const axios = require('axios');

// ==============================================================================
// 1. CONFIGURACIÓN PRINCIPAL
// ==============================================================================
const URL_WEXAIT = "https://wexait.com/api/v1/actualizar-inventario-secreto";
const TOKEN_SECRETO = "WexaitBot2026_Admin";

const URL_LOGIN_MAYFLUX = "https://mayflux.com/login";
const CORREO_PROVEEDOR = "Univedson1@gmail.com";
const CONTRASENA_PROVEEDOR = "Univedson1@gmail.com"; // <-- RECUERDA PONER TU CLAVE REAL

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
// 2. MOTOR DE SCRAPING (CLONADO DE TU LÓGICA DE COMPRAS)
// ==============================================================================
async function verificarStockProveedor() {
    console.log("\n[+] Iniciando inspección de inventario en Mayflux con Puppeteer...");
    let browser;
    try {
        // Lanzamos el navegador virtual de forma idéntica a tu bot de entregas
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

        // --- 1. LOGIN (Opcional para asegurar carga visual) ---
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
                
                // Pausa de seguridad de 3 segundos para que Vue/Nuxt termine de procesar el JavaScript visual
                await new Promise(r => setTimeout(r, 3000));

                // 🕵️‍♂️ VERIFICAR SI ESTÁ AGOTADO (Usando tu lógica exacta clonada)
                const estadoProducto = await page.evaluate(() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const btnCarrito = btns.find(b => b.innerText.toLowerCase().includes('añadir al carrito'));
                    const textoPagina = document.body.innerText.toLowerCase();

                    // Mismas reglas estrictas de tu bot de compras
                    if (!btnCarrito || textoPagina.includes('agotado') || textoPagina.includes('out of stock')) {
                        return 'agotado';
                    }
                    return 'disponible';
                });

                const hayStock = (estadoProducto === 'disponible');
                
                if (!hayStock) {
                    console.log("⚠️ Producto detectado como AGOTADO en Mayflux.");
                } else {
                    console.log("🛒 Producto con stock disponible.");
                }

                // Disparamos la actualización silenciosa a tu web
                await actualizarProductoWexait(prod.id_wexait, hayStock, prod.nombre);

            } catch (error) {
                console.log(`[!] Error al inspeccionar ${prod.nombre}: ${error.message}`);
            }
            
            // Pausa breve antes de abrir la siguiente pestaña
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
// 3. BUCLE DE TIEMPO (HORARIO NORMAL DEFINITIVO: 8 AM - 12 AM)
// ==============================================================================
function obtenerHoraColombia() {
    const ahora = new Date();
    const opciones = { timeZone: 'America/Bogota', hour: 'numeric', hour12: false };
    const formateador = new Intl.DateTimeFormat('en-US', opciones);
    return parseInt(formateador.format(ahora), 10);
}

async function iniciarVigilancia() {
    console.log("=======================================================");
    console.log("🚀 BOT VIGÍA MODO PRODUCCIÓN REAL (Horario Normal) INICIADO");
    console.log("=======================================================");

    while (true) {
        const horaActual = obtenerHoraColombia();
        
        // ⏰ Horario Normal: Activo estrictamente si la hora es >= 8 (de 8:00 AM a 11:59 PM)
        // Desde las 0 (12:00 AM) hasta las 7 (7:59 AM) entrará al descanso automáticamente.
        if (horaActual >= 8) {
            await verificarStockProveedor();
            console.log("[*] Misión terminada. Esperando 30 minutos para el siguiente escaneo...");
            await new Promise(r => setTimeout(r, 1800000)); // 30 minutos
        } else {
            console.log("[Noche COP] Horario inactivo. Bot en reposo nocturno (12 AM - 8 AM).");
            await new Promise(r => setTimeout(r, 900000)); // Espera bloques de 15 min hasta las 8 AM
        }
    }
}

// Arrancamos el motor
iniciarVigilancia();
