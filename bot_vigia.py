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
URL_LOGIN_MAYFLUX = "https://mayflux.com" 
CORREO_PROVEEDOR = "Univedson1@gmail.com"        # <-- TU CORREO REAL
CONTRASENA_PROVEEDOR = "Univedson1@gmail.com"     # <-- TU CONTRASEÑA REAL

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
            accion = "🟢 DISPONIBLE" if estado == 1 else "🔴 AGOTADO (off)"
            print(f"[*] Wexait sincronizado: {nombre_referencia} -> {accion}")
    except:
        print(f"[!] Error de conexión con Wexait")

# ==============================================================================
# 4. EL MOTOR DE LECTURA (SCRAPER BASADO EN TU CAPTURA)
# ==============================================================================
def verificar_stock_proveedor():
    print("\n[+] Iniciando revisión de inventario en Mayflux...")
    sesion = requests.Session()
    sesion.headers.update({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    # Iniciar Sesión
    try:
        sesion.post(URL_LOGIN_MAYFLUX, data={'username': CORREO_PROVEEDOR, 'password': CONTRASENA_PROVEEDOR, 'login': 'Login'}, timeout=15)
    except:
        pass

    for prod in PRODUCTOS_A_VIGILAR:
        try:
            respuesta = sesion.get(prod["url_proveedor"], timeout=15)
            soup = BeautifulSoup(respuesta.text, 'html.parser')
            
            # BUSQUEDA BASADA EN TU INSPECTOR:
            # 1. Buscamos el botón que tenga el texto de stock
            texto_pagina = respuesta.text.lower()
            
            # Prioridad 1: Si el botón tiene el atributo 'disabled', está agotado fijo.
            # Según tu captura, el botón de agotado tiene disabled=""
            boton_desactivado = soup.find('button', attrs={'disabled': True})
            
            if "producto agotado" in texto_pagina and boton_desactivado:
                hay_stock = False
            elif "añadir al carrito" in texto_pagina:
                # Verificamos que no sea un botón desactivado
                hay_stock = True
            else:
                # Si hay duda, buscamos la frase exacta en el HTML
                hay_stock = "añadir al carrito" in texto_pagina and "producto agotado" not in texto_pagina

            actualizar_producto_wexait(prod["id_wexait"], hay_stock, prod["nombre"])
            time.sleep(2)
            
        except Exception as e:
            print(f"[!] Error en {prod['nombre']}: {e}")

# ==============================================================================
# 5. BUCLE DE TIEMPO
# ==============================================================================
def iniciar_vigilancia():
    print("=======================================================")
    print("🚀 BOT VIGÍA PRECISO INICIADO (Horario Colombia)")
    print("=======================================================")

    while True:
        ahora = datetime.now(ZONA_COLOMBIA)
        if 8 <= ahora.hour <= 23:
            verificar_stock_proveedor()
            print(f"[*] Esperando 30 minutos... (Próxima revisión: {(ahora.hour if ahora.minute < 30 else ahora.hour+1)}:{(ahora.minute+30)%60:02d})")
            time.sleep(1800)
        else:
            print(f"[{ahora.strftime('%I:%M %p')}] Reposo nocturno.")
            time.sleep(900)

if __name__ == "__main__":
    iniciar_vigilancia()
