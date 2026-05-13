import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import pytz

# ==============================================================================
# 1. CONFIGURACIÓN DE WEXAIT
# ==============================================================================
URL_WEXAIT = "https://wexait.com/api/v1/actualizar-inventario-secreto"
TOKEN_SECRETO = "WexaitBot2026_Admin"

ZONA_COLOMBIA = pytz.timezone('America/Bogota')

# ==============================================================================
# 2. CONFIGURACIÓN DEL PROVEEDOR (MAYFLUX)
# ==============================================================================
URL_LOGIN_MAYFLUX = "https://mayflux.com/my-account/" 
CORREO_PROVEEDOR = "tu_correo@gmail.com"        # <-- PON TU CORREO DE MAYFLUX
CONTRASENA_PROVEEDOR = "tu_contrasena_aqui"     # <-- PON TU CONTRASEÑA DE MAYFLUX

# --- LISTA MAESTRA DE PRODUCTOS ---
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

# ==============================================================================
# 3. FUNCIÓN DE ACTUALIZACIÓN A LA WEB (SILENCIOSA)
# ==============================================================================
def actualizar_producto_wexait(producto_id, hay_stock, nombre_referencia):
    estado = 1 if hay_stock else 0
    payload = {'id': producto_id, 'status': estado, 'token': TOKEN_SECRETO}
    try:
        res = requests.post(URL_WEXAIT, data=payload, timeout=15)
        if res.status_code == 200:
            accion = "🟢 DISPONIBLE" if estado == 1 else "🔴 AGOTADO (off)"
            print(f"[*] Wexait sincronizado: {nombre_referencia} -> {accion}")
        else:
            print(f"[!] Falló actualización en Wexait para ID {producto_id}. HTTP {res.status_code}")
    except Exception as e:
        print(f"[!] Error conectando a Wexait: {e}")

# ==============================================================================
# 4. EL MOTOR DE LECTURA (SCRAPER CON SESIÓN)
# ==============================================================================
def verificar_stock_proveedor():
    print("\n[+] Iniciando revisión de inventario en Mayflux...")
    
    # Creamos la sesión para mantener las cookies de inicio de sesión
    sesion = requests.Session()
    sesion.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    # 1. INICIAR SESIÓN EN EL PROVEEDOR
    datos_login = {
        'username': CORREO_PROVEEDOR,
        'password': CONTRASENA_PROVEEDOR,
        'login': 'Login'
    }
    
    try:
        sesion.post(URL_LOGIN_MAYFLUX, data=datos_login, timeout=15)
    except Exception as e:
        print(f"[!] Advertencia al iniciar sesión en Mayflux: {e}")

    # 2. RECORRER CADA PRODUCTO DE LA LISTA
    for prod in PRODUCTOS_A_VIGILAR:
        id_wexait = prod["id_wexait"]
        url_prov = prod["url_proveedor"]
        nombre = prod["nombre"]
        
        try:
            respuesta = sesion.get(url_prov, timeout=15)
            texto_html = respuesta.text.lower()
            
            # --- LÓGICA DE DETECCIÓN INTELIGENTE ---
            if "producto agotado" in texto_html:
                hay_stock = False
            elif "añadir al carrito" in texto_html:
                hay_stock = True
            else:
                # Respaldo buscando las clases nativas de WooCommerce
                soup = BeautifulSoup(respuesta.text, 'html.parser')
                if soup.find(class_="out-of-stock"):
                    hay_stock = False
                else:
                    hay_stock = True
            
            # Enviamos la orden directa a tu página web
            actualizar_producto_wexait(id_wexait, hay_stock, nombre)
            
            # Pausa de 2 segundos entre cada producto para cuidar la conexión
            time.sleep(2)
            
        except Exception as e:
            print(f"[!] Error al leer el producto {nombre} en Mayflux: {e}")

# ==============================================================================
# 5. EL BUCLE INTERNO DE TIEMPO
# ==============================================================================
def iniciar_vigilancia():
    print("=======================================================")
    print("🚀 BOT VIGÍA SILENCIOSO INICIADO (Horario Colombia)")
    print("=======================================================")

    while True:
        ahora = datetime.now(ZONA_COLOMBIA)
        hora = ahora.hour
        hora_str = ahora.strftime('%I:%M %p')

        # Trabaja estrictamente entre las 8:00 AM y las 11:59 PM
        if 8 <= hora <= 23:
            print(f"\n[{hora_str} COP] Verificando inventario...")
            verificar_stock_proveedor()
            
            print("[*] Ciclo terminado. Esperando 30 minutos...")
            time.sleep(1800) # Duerme 30 minutos
        else:
            print(f"[{hora_str} COP] Madrugada en Colombia. Bot en reposo.")
            time.sleep(900) # En la madrugada solo revisa la hora cada 15 minutos

if __name__ == "__main__":
    iniciar_vigilancia()
