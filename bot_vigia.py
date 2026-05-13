import time
import requests
from datetime import datetime
import pytz

# Importamos el gestor de navegador headless moderno
from playwright.sync_api import sync_playwright

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
# 2. MOTOR VISUAL RENDERING (PLAYWRIGHT)
# ==============================================================================
def verificar_stock_proveedor():
    print("\n[+] Iniciando motor visual (Playwright) para procesar Mayflux...")
    
    with sync_playwright() as p:
        # Lanzamos Chromium optimizado para servidores sin pantalla
        navegador = p.chromium.launch(headless=True, chromium_sandbox=False)
        contexto = navegador.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 720}
        )
        pagina = contexto.new_page()
        
        # Opcional: Intento de inicio de sesión visual
        try:
            print("[*] Cargando portal de acceso...")
            pagina.goto(URL_BASE_MAYFLUX, timeout=30000)
            # Damos tiempo a que la app cargue su JS
            pagina.wait_for_load_state("networkidle", timeout=10000)
            
            # Buscamos inputs de login si están visibles
            if pagina.locator("input[type='password']").is_visible():
                pagina.locator("input[type='email'], input[name*='user']").first.fill(CORREO_PROVEEDOR)
                pagina.locator("input[type='password']").fill(CONTRASENA_PROVEEDOR)
                pagina.locator("input[type='password']").press("Enter")
                pagina.wait_for_load_state("networkidle", timeout=10000)
                print("[*] Autenticación visual completada.")
        except Exception as e:
            print("[?] Omitiendo login (sesión guardada o interfaz no detectada).")

        # Recorremos el catálogo
        for prod in PRODUCTOS_A_VIGILAR:
            print(f"[*] Inspeccionando visualmente: {prod['nombre']}...")
            try:
                # Navegamos y esperamos a que la página termine de procesar sus peticiones internas
                pagina.goto(prod["url_proveedor"], timeout=40000)
                pagina.wait_for_load_state("networkidle", timeout=15000)
                
                # Pausa extra de 3 segundos para que las animaciones o textos de Nuxt terminen de aparecer
                pagina.wait_for_timeout(3000)
                
                # Extraemos todo el texto visible renderizado por el navegador
                contenido_visual = pagina.content().lower()
                
                # --- VERIFICACIÓN DIRECTA EN PANTALLA ---
                es_agotado = ("stock: 0" in contenido_visual) or ("producto agotado" in contenido_visual) or ("out of stock" in contenido_visual)
                es_disponible = ("añadir al carrito" in contenido_visual) or ("agregar" in contenido_visual) or ("stock:" in contenido_visual and "stock: 0" not in contenido_visual)
                
                if es_agotado:
                    hay_stock = False
                elif es_disponible:
                    hay_stock = True
                else:
                    print(f"[?] No se detectaron botones clave en pantalla. Protegiendo con (OFF).")
                    hay_stock = False
                    
                actualizar_producto_wexait(prod["id_wexait"], hay_stock, prod["nombre"])
                
            except Exception as e:
                print(f"[!] Error cargando la vista de {prod['nombre']}: {e}")
            
            time.sleep(2)
            
        contexto.close()
        navegador.close()
        print("[*] Motor visual cerrado correctamente.")

# ==============================================================================
# 3. BUCLE DE TIEMPO (HASTA LAS 4 AM)
# ==============================================================================
def iniciar_vigilancia():
    print("=======================================================")
    print("🚀 BOT VIGÍA (PLAYWRIGHT VISUAL) INICIADO")
    print("=======================================================")

    while True:
        ahora = datetime.now(ZONA_COLOMBIA)
        
        if ahora.hour >= 8 or ahora.hour <= 4:
            verificar_stock_proveedor()
            print(f"[*] Esperando 30 minutos...")
            time.sleep(1800)
        else:
            print(f"[{ahora.strftime('%I:%M %p')}] Mantenimiento (5 AM - 8 AM).")
            time.sleep(900)

if __name__ == "__main__":
    iniciar_vigilancia()
