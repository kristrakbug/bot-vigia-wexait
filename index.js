const puppeteer = require('puppeteer');
const axios = require('axios');

// ==============================================================================
// 1. CONFIGURACIÓN PRINCIPAL (CON VARIABLES DE ENTORNO SEGURAS)
// ==============================================================================
const URL_WEXAIT = "https://wexait.com/api/v1/actualizar-inventario-secreto";
const TOKEN_SECRETO = process.env.TOKEN_SECRETO;

const URL_LOGIN_MAYFLUX = "https://mayflux.com/login";
const CORREO_PROVEEDOR = process.env.CORREO_PROVEEDOR;
const CONTRASENA_PROVEEDOR = process.env.CONTRASENA_PROVEEDOR;

// GENERA VARIANTES CON Y SIN -1 (O CUALQUIER NÚMERO)
function generarVariantesUrl(urlOriginal) {
    if (!urlOriginal || typeof urlOriginal !== 'string') return [];
    const urlLimpia = urlOriginal.trim().replace(/\/$/, '');
    const variantes = [urlLimpia];

    if (/-\d+$/.test(urlLimpia)) {
        // Si termina en -1 o -2, probar también la versión limpia
        variantes.push(urlLimpia.replace(/-\d+$/, ''));
    } else {
        // Si viene sin número al final, probar agregándole -1
        variantes.push(`${urlLimpia}-1`);
    }

    return variantes;
}

// PIDE LA LISTA DINÁMICA A WEXAIT
async function obtenerProductosDesdeWexait() {
    try {
        console.log("\n[*] Consultando a Wexait la lista de productos de MAYFLUX actualizada...");
        const res = await axios.get("https://wexait.com/api/lista-vigilancia-mayflux");
        
        if (res.data && res.data.length > 0) {
            console.log(`✅ Wexait devolvió ${res.data.length} productos para vigilar en Mayflux.`);
            return res.data;
        }
    } catch (error) {
        console.log("[!] Error obteniendo la lista de Wexait. Asegúrate de que la ruta exista.");
    }
    return [];
}

// RECIBE Y ENVÍA 'cantidad_stock'
async function actualizarProductoWexait(producto_id, hay_stock, cantidad_stock, nombre_referencia) {
    const estado_api = hay_stock ? 1 : 0;
    try {
        const params = new URLSearchParams();
        params.append('id', producto_id);
        params.append('status', estado_api);
        params.append('stock', cantidad_stock);
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

// FUNCIÓN AUXILIAR PARA LEER LA PÁGINA
async function extraerDatosPagina(page) {
    return await page.evaluate(() => {
        const bodyText = document.body ? document.body.innerText || '' : '';

        // Si la página es 404 o no existe el producto
        if (bodyText.includes('404') || bodyText.toLowerCase().includes('página no encontrada') || bodyText.toLowerCase().includes('producto no encontrado')) {
            return { estado: 'no_existe', diasDetectados: null, stockLeido: 0 };
        }

        const btns = Array.from(document.querySelectorAll('button'));
        const btnCarrito = btns.find(b => b.innerText && b.innerText.toLowerCase().includes('carrito'));
        
        let isBtnDisabled = false;
        if (btnCarrito) {
            isBtnDisabled = btnCarrito.disabled || btnCarrito.classList.contains('disabled');
        }

        const elementosTexto = Array.from(document.querySelectorAll('span, div, p, b, strong'));
        
        // 1. Detectar Stock
        let numeroStock = 0;
        const elStock = elementosTexto.find(s => s.innerText && s.innerText.toLowerCase().includes('stock'));
        if (elStock) {
            const match = elStock.innerText.match(/stock[:\s]*(\d+)/i) || elStock.innerText.match(/\d+/);
            if (match) {
                numeroStock = parseInt(match[1] || match[0], 10);
            }
        }

        // 2. Detectar Días
        let diasDetectados = null;
        const elDias = elementosTexto.find(s => s.innerText && s.innerText.toLowerCase().match(/\d+\s*d[íi]as?/i));
        if (elDias) {
            const matchDias = elDias.innerText.match(/(\d+)\s*d[íi]as?/i);
            if (matchDias) {
                diasDetectados = parseInt(matchDias[1], 10);
            }
        }

        let estado = 'agotado'; 
        if (btnCarrito && !isBtnDisabled && numeroStock > 0) {
            estado = 'disponible';
        }

        return { estado, diasDetectados, stockLeido: numeroStock };
    });
}

// ==============================================================================
// 2. MOTOR DE SCRAPING 
// ==============================================================================
async function verificarStockProveedor() {
    if (!CORREO_PROVEEDOR || !CONTRASENA_PROVEEDOR || !TOKEN_SECRETO) {
        console.error("❌ Faltan las variables de entorno (Secrets) en GitHub.");
        process.exit(1);
    }

    const PRODUCTOS_A_VIGILAR = await obtenerProductosDesdeWexait();
    
    if (PRODUCTOS_A_VIGILAR.length === 0) {
        console.log("⚠️ No hay productos con enlace de Mayflux en tu panel de Wexait. Cerrando...");
        return; 
    }

    console.log("\n[+] Iniciando inspección de inventario en Mayflux con Puppeteer...");
    let browser;
    try {
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
                const urlsAProbar = generarVariantesUrl(prod.url_proveedor);
                let resultadoScraping = { estado: 'agotado', diasDetectados: null, stockLeido: 0 };
                let urlExitosa = prod.url_proveedor;

                for (let i = 0; i < urlsAProbar.length; i++) {
                    const urlActual = urlsAProbar[i];
                    console.log(`[*] Inspeccionando intento (${i + 1}/${urlsAProbar.length}): ${urlActual}`);

                    try {
                        await page.goto(urlActual, { waitUntil: 'networkidle2', timeout: 45000 });
                        await new Promise(r => setTimeout(r, 4000));

                        const intento = await extraerDatosPagina(page);

                        // Si la página cargó y detectó datos válidos (días o stock presente)
                        if (intento.estado !== 'no_existe' && (intento.diasDetectados !== null || intento.stockLeido > 0)) {
                            resultadoScraping = intento;
                            urlExitosa = urlActual;
                            console.log(`✅ Producto cargado correctamente desde: ${urlActual}`);
                            break;
                        } else {
                            console.log(`⚠️ Enlace sin datos o 404 en ${urlActual}. Probando alternativa...`);
                        }
                    } catch (eNav) {
                        console.log(`[!] Timeout navegando a ${urlActual}: ${eNav.message}`);
                    }
                }

                let hayStock = (resultadoScraping.estado === 'disponible');
                console.log(`[🔍] Diagnóstico: Stock leído = ${resultadoScraping.stockLeido}, Días detectados = ${resultadoScraping.diasDetectados}`);

                // ============================================================
                // 🛡️ SISTEMA DE PROTECCIÓN DE MARGEN (DOBLE VERIFICACIÓN)
                // ============================================================
                const matchEsperados = prod.nombre.match(/(\d+)\s*d[íi]as?/i);
                const diasEsperados = matchEsperados ? parseInt(matchEsperados[1], 10) : null;

                if (hayStock && resultadoScraping.diasDetectados && diasEsperados) {
                    if (resultadoScraping.diasDetectados > diasEsperados) {
                        console.log(`⚠️ ALERTA (Strike 1/2): Posible cambio a ${resultadoScraping.diasDetectados} días. Re-verificando en 5 segundos...`);
                        await new Promise(r => setTimeout(r, 5000));
                        await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
                        await new Promise(r => setTimeout(r, 4000));
                        
                        resultadoScraping = await extraerDatosPagina(page);
                        if (resultadoScraping.diasDetectados > diasEsperados) {
                            hayStock = false;
                            console.log(`🛡️ ESCUDO ACTIVADO (Strike 2/2): Confirmado ${resultadoScraping.diasDetectados} días (Esperabas: ${diasEsperados}). Forzando a AGOTADO.`);
                        }
                    }
                }
                // ============================================================

                if (!hayStock) {
                    console.log("⚠️ Producto marcado como AGOTADO.");
                } else {
                    console.log("🛒 Producto con stock disponible.");
                }

                await actualizarProductoWexait(prod.id_wexait, hayStock, resultadoScraping.stockLeido, prod.nombre);

            } catch (error) {
                console.log(`[!] Error al inspeccionar ${prod.nombre}: ${error.message}`);
            }
            
            await new Promise(r => setTimeout(r, 2000));
        }

    } catch (error) {
        console.error("❌ Error General de Puppeteer:", error.message);
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
            console.log("[*] Navegador cerrado.");
        }
    }
}

// ==============================================================================
// 3. EJECUCIÓN ÚNICA PARA GITHUB ACTIONS
// ==============================================================================
async function iniciarVigilancia() {
    console.log("=======================================================");
    console.log("🚀 BOT VIGÍA DE MAYFLUX (MODO GITHUB ACTIONS) INICIADO");
    console.log("=======================================================");
    
    await verificarStockProveedor();
    
    console.log("=======================================================");
    console.log("🏁 Escaneo completado. Apagando contenedor hasta el próximo turno.");
    console.log("=======================================================");
    process.exit(0);
}

iniciarVigilancia();
