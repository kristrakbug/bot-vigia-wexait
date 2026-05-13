import time
import requests
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
URL_LOGIN_MAYFLUX = "https://mayflux.com" 
CORREO_PROVEEDOR = "Univedson1@gmail.com"        # <-- TU CORREO REAL
CONTRASENA_PROVEEDOR = "Univedson1@gmail.com"  # <-- PON TU CONTRASEÑA REAL (Ojo, no pongas el correo de nuevo)

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
# 3. FUNCIÓN DE ACTUALIZACIÓN (SILENCIOSA)
# ==============================================================================
def actualizar_producto_wexait(producto_id, hay_stock, nombre_referencia):
    estado = 1 if hay_stock else 0
    payload = {'id': producto_id, 'status': estado, 'token': TOKEN_SECRETO}
    try:
        res = requests.post(URL_WEXAIT, data=payload, timeout=15)
        if res.status_code == 200:
            accion = "🟢 DISPONIBLE" if estado == 1 else "🔴 AGOTADO (OFF)"
            print(f"[*] Wexait sincronizado: {nombre_referencia} -> {accion}")
    except:
        print(f"[!] Error de conexión con Wexait")

# ==============================================================================
# 4. EL MOTOR DE LECTURA (OPTIMIZADO PARA MAYFLUX / NUXT.JS)
# ==============================================================================
def verificar_stock_proveedor():
    print("\n[+] Iniciando revisión de inventario en Mayflux...")
    sesion = requests.Session()
    sesion.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    # Iniciar Sesión en el proveedor
    try:
        sesion.post(URL_LOGIN_MAYFLUX, data={'username': CORREO_PROVEEDOR, 'password': CONTRASENA_PROVEEDOR, 'login': 'Login'}, timeout=15)
    except:
        pass

    for prod in PRODUCTOS_A_VIGILAR:
        try:
            respuesta = sesion.get(prod["url_proveedor"], timeout=15)
            texto_bruto = respuesta.text.lower()
            
            # --- DETECCIÓN DIRECTA POR TEXTO PURO ---
            # Ignoramos HTML complejo. Buscamos directamente si la página dice "stock: 0" o "producto agotado".
            if "stock: 0" in texto_bruto or "producto agotado" in texto_bruto:
                hay_stock = False
            else:
                hay_stock = True

            actualizar_producto_wexait(prod["id_wexait"], hay_stock, prod["nombre"])
            time.sleep(2)
            
        except Exception as e:
            print(f"[!] Error en {prod['nombre']}: {e}")

# ==============================================================================
# 5. BUCLE DE TIEMPO
# ==============================================================================
def iniciar_vigilancia():
    print("=======================================================")
    print("🚀 BOT VIGÍA NUXT-OPTIMIZADO INICIADO (Horario Colombia)")
    print("=======================================================")

    while True:
        ahora = datetime.now(ZONA_COLOMBIA)
        if 8 <= ahora.hour <= 23:
            verificar_stock_proveedor()
            
            # Cálculo visual de la próxima hora para la consola
            minuto_actual = ahora.minute
            hora_proxima = ahora.hour if minuto_actual < 30 else (ahora.hour + 1) % 24
            minuto_proximo = (minuto_actual + 30) % 60
            print(f"[*] Esperando 30 minutos... (Próxima revisión aprox: {hora_proxima:02d}:{minuto_proximo:02d})")
            
            time.sleep(1800)
        else:
            print(f"[{ahora.strftime('%I:%M %p')}] Reposo nocturno.")
            time.sleep(900)

if __name__ == "__main__":
    iniciar_vigilancia()
