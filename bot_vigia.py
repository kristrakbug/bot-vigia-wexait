import time
import requests
from datetime import datetime
import pytz

# ==============================================================================
# CONFIGURACIÓN PRINCIPAL
# ==============================================================================
URL_WEXAIT = "https://wexait.com/api/v1/actualizar-inventario-secreto"
TOKEN_SECRETO = "WexaitBot2026_Admin"

# Zona horaria estricta de Colombia
ZONA_COLOMBIA = pytz.timezone('America/Bogota')

# Credenciales de Telegram
TELEGRAM_TOKEN = "7522671094:AAGQUfaRWNG3byCmPFQmxpnYxSkLDKMxFek"
TELEGRAM_CHAT_ID = "-1003777513176"

def enviar_alerta_telegram(mensaje):
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        'chat_id': TELEGRAM_CHAT_ID,
        'text': mensaje,
        'parse_mode': 'HTML',
        'disable_notification': True
    }
    try:
        requests.post(url, json=payload, timeout=10)
    except:
        pass

def actualizar_producto_wexait(producto_id, hay_stock):
    estado = 1 if hay_stock else 0
    payload = {
        'id': producto_id,
        'status': estado,
        'token': TOKEN_SECRETO
    }
    try:
        respuesta = requests.post(URL_WEXAIT, data=payload, timeout=15)
        if respuesta.status_code == 200:
            datos = respuesta.json()
            nombre = datos.get('nombre_mostrado', f'ID {producto_id}')
            accion = "🟢 ACTIVADO" if estado == 1 else "🔴 AGOTADO (off)"
            print(f"[*] Wexait actualizado: {nombre} -> {accion}")
        else:
            print(f"[!] Error en la web. Código: {respuesta.status_code}")
    except Exception as e:
        print(f"[!] Error de conexión con Wexait: {e}")

def verificar_stock_proveedor():
    print("\n[+] Consultando inventario del proveedor...")
    
    # --------------------------------------------------------------------------
    # AQUÍ DEBES INTEGRAR LA LÓGICA REAL DE TU PROVEEDOR
    # Ejemplo de prueba con IDs simulados:
    # --------------------------------------------------------------------------
    crunchyroll_disponible = True   # Simula que hay stock para el ID 5
    paramount_disponible = False    # Simula que está agotado para el ID 6
    
    actualizar_producto_wexait(producto_id=5, hay_stock=crunchyroll_disponible)
    actualizar_producto_wexait(producto_id=6, hay_stock=paramount_disponible)

def iniciar_vigilancia():
    print("=======================================================")
    print("🚀 BOT VIGÍA INICIADO (Horario Colombia)")
    print("=======================================================")
    enviar_alerta_telegram("🟢 <b>Bot Vigía:</b> Iniciando ciclo de monitoreo.")

    while True:
        ahora = datetime.now(ZONA_COLOMBIA)
        hora = ahora.hour
        minuto = ahora.minute
        hora_str = ahora.strftime('%I:%M %p')

        # Horario activo: 8:00 AM a 11:59 PM
        if 8 <= hora <= 23:
            print(f"\n[{hora_str} COP] Horario activo. Verificando stock...")
            try:
                verificar_stock_proveedor()
            except Exception as e:
                print(f"[!] Error en verificación: {e}")
            
            print("[*] Esperando 30 minutos...")
            time.sleep(1800)
        else:
            # Horario inactivo: 12:00 AM a 7:59 AM
            if hora == 0 and minuto < 15:
                enviar_alerta_telegram("🌙 <b>Bot Vigía:</b> Modo reposo hasta las 8:00 AM.")
            
            print(f"[{hora_str} COP] Fuera de horario comercial. Durmiendo...")
            time.sleep(900) # Revisa la hora cada 15 minutos en la madrugada

if __name__ == "__main__":
    iniciar_vigilancia()
