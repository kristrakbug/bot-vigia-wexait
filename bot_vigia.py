import time
import re
import requests
from datetime import datetime
import pytz

# ==============================================================================
# 1. CONFIGURACIÓN PRINCIPAL
# ==============================================================================
URL_WEXAIT = "https://wexait.com/api/v1/actualizar-inventario-secreto"
TOKEN_SECRETO = "WexaitBot2026_Admin"
ZONA_COLOMBIA = pytz.timezone('America/Bogota')

URL_BASE_MAYFLUX = "https://mayflux.com/" 
CORREO_PROVEEDOR = "Univedson1@gmail.com"        
CONTRASENA_PROVEEDOR = "Univedson1@gmail.com"  # <-- RECUERDA PONER TU CLAVE REAL

PRODUCTOS_A_VIGILAR = [
    {
        "id_wexait": 5,
        "nombre": "AMAZON PRIME VIDEO PANTALLA (30 Dias)",
        "url_proveedor": "https://mayflux.com/product/amazon-prime-video-pantalla-1"
    },
    {
        "id_wexait": 19,
        "nombre": "DISNEY+ Estándar PANTALLA (30 Dias)",
        "url_proveedor": "https://mayflux.com/product/disney-pantalla-premium-sin-espn"
    },
    {
        "id_wexait": 4,
        "nombre": "HBO MAX PANTALLA(30 Dias)",
        "url_proveedor": "https://mayflux.com/product/max-pantalla-sin-anuncios-1"
    }
]

def actualizar_producto_wexait(producto_id, hay_stock, nombre_referencia):
    estado_api = 1 if hay_stock else 0
    payload = {'id': producto_id, 'status': estado_api, 'token': TOKEN_SECRETO}
    try:
        res = requests.post(URL_WEXAIT, data=payload, timeout=15)
        if res.status_code == 200:
            accion = "🟢 DISPONIBLE" if hay_stock else "🔴 AGOTADO (OFF)"
            print(f"[*] Wexait sincronizado: {nombre_referencia} -> {accion}")
    except:
        print(f"[!] Error de conexión con Wexait")

# ==============================================================================
# 2. MOTOR DE SCRAPING DE MEMORIA NUXT (SIN SELENIUM)
# ==============================================================================
def verificar_stock_proveedor():
    print("\n[+] Extrayendo memoria de estado (Nuxt JSON) desde Mayflux...")
    sesion = requests.Session()
    
    sesion.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    })

    try:
        sesion.post(URL_BASE_MAYFLUX, data={'username': CORREO_PROVEEDOR, 'password': CONTRASENA_PROVEEDOR, 'login': 'Login'}, timeout=15)
    except:
        pass

    for prod in PRODUCTOS_A_VIGILAR:
        try:
            respuesta = sesion.get(prod["url_proveedor"], timeout=15)
            
            if respuesta.status_code != 200:
                print(f"[!] Acceso denegado a {prod['nombre']} (HTTP {respuesta.status_code})")
                continue

            texto_html = respuesta.text
            
            # --- BÚSQUEDA DIRECTA EN EL CÓDIGO FUENTE DE NUXT ---
            bloque_nuxt = re.search(r'window\.__NUXT__\s*=\s*(\(.*?\));', texto_html)
            if not bloque_nuxt:
                bloque_nuxt = re.search(r'<script[^>]*>.*?(?:__NUXT__|"stock").*?</script>', texto_html, re.DOTALL)
            
            area_busqueda = bloque_nuxt.group(0).lower() if bloque_nuxt else texto_html.lower()

            patrones_agotado = ['"stock":0', '"stock": 0', 'stock: 0', '"quantity":0', '"outofstock"', 'producto agotado']
            patrones_disponible = ['"stock":', 'stock:', 'añadir al carrito', 'add to cart']

            if any(p in area_busqueda for p in patrones_agotado):
                hay_stock = False
            elif any(p in area_busqueda for p in patrones_disponible):
                hay_stock = True
            else:
                print(f"[?] Metadatos incompletos para {prod['nombre']}. Protegiendo con etiqueta (OFF).")
                hay_stock = False

            actualizar_producto_wexait(prod["id_wexait"], hay_stock, prod["nombre"])
            time.sleep(2)

        except Exception as e:
            print(f"[!] Error procesando {prod['nombre']}: {e}")

# ==============================================================================
# 3. BUCLE DE TIEMPO (HORARIO EXTENDIDO HASTA LAS 4 AM)
# ==============================================================================
def iniciar_vigilancia():
    print("=======================================================")
    print("🚀 BOT VIGÍA (SCRAPER DE MEMORIA NUXT) INICIADO")
    print("=======================================================")

    while True:
        ahora = datetime.now(ZONA_COLOMBIA)
        
        if ahora.hour >= 8 or ahora.hour <= 4:
            verificar_stock_proveedor()
            print(f"[*] Esperando 30 minutos...")
            time.sleep(1800)
        else:
            print(f"[{ahora.strftime('%I:%M %p')}] Mantenimiento programado (5 AM - 8 AM).")
            time.sleep(900)

if __name__ == "__main__":
    iniciar_vigilancia()
