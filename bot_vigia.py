import time
import requests
from datetime import datetime
import pytz

# Librerías de Selenium
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

# ==============================================================================
# 1. CONFIGURACIÓN PRINCIPAL
# ==============================================================================
URL_WEXAIT = "https://wexait.com/api/v1/actualizar-inventario-secreto"
TOKEN_SECRETO = "WexaitBot2026_Admin"
ZONA_COLOMBIA = pytz.timezone('America/Bogota')

URL_LOGIN_MAYFLUX = "https://mayflux.com/my-account/" 
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
# 2. MOTOR DE SCRAPING CON NAVEGADOR NATIVO (RAILWAY NIXPACKS)
# ==============================================================================
def verificar_stock_proveedor():
    print("\n[+] Iniciando Chromium nativo en el servidor para leer Mayflux...")
    
    opciones = Options()
    opciones.add_argument("--headless=new") 
    opciones.add_argument("--no-sandbox")
    opciones.add_argument("--disable-dev-shm-usage")
    opciones.add_argument("--disable-gpu")
    opciones.add_argument("--window-size=1920,1080")
    opciones.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")

    driver = None
    try:
        # Al instalar Chromium vía nixpacks, Selenium lo detecta de forma nativa
        driver = webdriver.Chrome(options=opciones)
        
        print("[*] Abriendo web de Mayflux...")
        driver.get(URL_LOGIN_MAYFLUX)
        time.sleep(4) 
        
        try:
            campo_user = driver.find_element(By.XPATH, "//input[@type='email' or contains(@name, 'user') or contains(@name, 'email')]")
            campo_pass = driver.find_element(By.XPATH, "//input[@type='password']")
            campo_user.send_keys(CORREO_PROVEEDOR)
            campo_pass.send_keys(CONTRASENA_PROVEEDOR)
            campo_pass.submit()
            time.sleep(5) 
            print("[*] Sesión iniciada en el navegador invisible.")
        except:
            print("[?] Omitiendo inicio de sesión (ya activo o no requerido)...")

        for prod in PRODUCTOS_A_VIGILAR:
            print(f"[*] Consultando: {prod['nombre']}...")
            driver.get(prod["url_proveedor"])
            
            # Pausa estricta para que Nuxt.js procese y renderice la página visual
            time.sleep(5) 
            
            texto_renderizado = driver.page_source.lower()
            
            es_agotado = ("stock: 0" in texto_renderizado) or ("producto agotado" in texto_renderizado)
            es_disponible = ("añadir al carrito" in texto_renderizado) or ("stock:" in texto_renderizado and "stock: 0" not in texto_renderizado)
            
            if es_agotado:
                hay_stock = False
            elif es_disponible:
                hay_stock = True
            else:
                print(f"[?] Estado ambiguo. Protegiendo catálogo con etiqueta (OFF).")
                hay_stock = False
                
            actualizar_producto_wexait(prod["id_wexait"], hay_stock, prod["nombre"])
            time.sleep(2)

    except Exception as e:
        print(f"[!] Error en el navegador invisible: {e}")
    finally:
        if driver:
            driver.quit()
            print("[*] Navegador cerrado para liberar memoria RAM.")

# ==============================================================================
# 3. BUCLE DE TIEMPO (AMPLIADO HASTA LAS 4 AM)
# ==============================================================================
def iniciar_vigilancia():
    print("=======================================================")
    print("🚀 BOT VIGÍA (SELENIUM NATIVO) INICIADO")
    print("=======================================================")

    while True:
        ahora = datetime.now(ZONA_COLOMBIA)
        
        # Trabaja si son las 8 AM en adelante, O si es la madrugada hasta las 4:59 AM
        if ahora.hour >= 8 or ahora.hour <= 4:
            verificar_stock_proveedor()
            print(f"[*] Esperando 30 minutos...")
            time.sleep(1800)
        else:
            print(f"[{ahora.strftime('%I:%M %p')}] Pausa de mantenimiento (5 AM - 8 AM).")
            time.sleep(900)

if __name__ == "__main__":
    iniciar_vigilancia()
