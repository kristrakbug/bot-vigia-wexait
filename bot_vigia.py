import time
import requests
from datetime import datetime
import pytz

# ==============================================================================
# 1. CONFIGURACIÓN PRINCIPAL
# ==============================================================================
URL_WEXAIT = "https://wexait.com/api/v1/actualizar-inventario-secreto"
TOKEN_SECRETO = "WexaitBot2026_Admin"
ZONA_COLOMBIA = pytz.timezone('America/Bogota')

# URL de inicio corregida por ti
URL_BASE_MAYFLUX = "https://mayflux.com/" 
CORREO_PROVEEDOR = "Univedson1@gmail.com"        
CONTRASENA_PROVEEDOR = "Univedson1@gmail.com"  # <-- REEMPLAZA CON TU CLAVE REAL

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
    # Si hay_stock es False (0), el controlador pondrá el (OFF) y mantendrá la tarjeta visible
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
# 2. MOTOR DE SCRAPING OPTIMIZADO
# ==============================================================================
def verificar_stock_proveedor():
    print("\n[+] Iniciando revisión de inventario en Mayflux...")
    sesion = requests.Session()
    
    # Cabeceras para que Mayflux nos vea como un navegador real
    sesion.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Referer': 'https://mayflux.com/',
        'Connection': 'keep-alive'
    })

    # Intentar login en la URL base
    try:
        sesion.post(URL_BASE_MAYFLUX, data={'username': CORREO_PROVEEDOR, 'password': CONTRASENA_PROVEEDOR, 'login': 'Login'}, timeout=15)
    except:
        pass

    for prod in PRODUCTOS_A_VIGILAR:
        try:
            respuesta = sesion.get(prod["url_proveedor"], timeout=15)
            texto_bruto = respuesta.text.lower()
            
            if respuesta.status_code != 200:
                print(f"[!] Error HTTP {respuesta.status_code} al leer {prod['nombre']}")
                continue

            # --- DETECCIÓN BASADA EN TUS CAPTURAS ---
            # Buscamos el "Stock: 0" que vimos en tu inspector
            # Buscamos "Producto Agotado" que sale en el botón gris
            
            es_agotado = ("stock: 0" in texto_bruto) or ("producto agotado" in texto_bruto) or ("agotado" in texto_bruto)
            
            if es_agotado:
                hay_stock = False
            elif "añadir al carrito" in texto_bruto or "agregar" in texto_bruto:
                hay_stock = True
            else:
                # Si el bot tiene dudas (página a medio cargar), marca AGOTADO por precaución
                print(f"[?] Stock dudoso en {prod['nombre']}. Marcando (OFF) por seguridad.")
                hay_stock = False

            actualizar_producto_wexait(prod["id_wexait"], hay_stock, prod["nombre"])
            time.sleep(2) 
            
        except Exception as e:
            print(f"[!] Error de lectura en {prod['nombre']}: {e}")

# ==============================================================================
# 3. BUCLE DE TIEMPO
# ==============================================================================
def iniciar_vigilancia():
    print("=======================================================")
    print("🚀 BOT VIGÍA (URL ACTUALIZADA) INICIADO")
    print("=======================================================")

    while True:
        ahora = datetime.now(ZONA_COLOMBIA)
        if 8 <= ahora.hour <= 23:
            verificar_stock_proveedor()
            print(f"[*] Ciclo completo. Esperando 30 minutos...")
            time.sleep(1800)
        else:
            print(f"[{ahora.strftime('%I:%M %p')}] Horario de descanso. Reposo nocturno.")
            time.sleep(900)

if __name__ == "__main__":
    iniciar_vigilancia()
