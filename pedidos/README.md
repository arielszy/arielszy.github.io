# Gestión de Pedidos - PWA

Sistema de gestión de pedidos con sincronización en tiempo real entre cliente y servidor.

## Características

✅ **PWA Completo**
- Funciona offline
- Se puede instalar como app
- Almacenamiento en IndexedDB

✅ **Gestión Completa**
- Clientes
- Pedidos con estados
- Pagos y cuentas corrientes
- Reportes detallados

✅ **Sincronización en Tiempo Real**
- Cambios se guardan localmente
- Se sincronizan automáticamente cada 30 segundos
- Cola de sincronización si hay desconexión
- Sincronización manual disponible

✅ **Filtros Avanzados**
- Por cliente
- Por fechas
- Por estado

## Instalación

1. Copia los archivos en tu servidor
2. Configura la URL del servidor en Configuración > Sincronización
3. ¡Listo!

## Archivos Necesarios

- `index.html` - HTML principal
- `app.js` - Lógica de la aplicación
- `sw.js` - Service Worker
- `manifest.json` - Configuración PWA

## Sincronización con Servidor

Configura en `Configuración > Sincronización`:
- URL del servidor (ej: `https://tu-servidor.com/api`)
- API Key (opcional)

Los cambios se enviarán automáticamente al servidor en POST, PUT y DELETE.

## Uso Offline

La app funciona completamente offline:
- Los datos se guardan localmente en IndexedDB
- Los cambios se colean en la base de datos local
- Se sincronizan automáticamente cuando hay conexión