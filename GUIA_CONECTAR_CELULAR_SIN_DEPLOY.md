# 📱 Guía: Cómo abrir la página desde el celular SIN hacer deploy (Red Local)

Esta guía explica **exactamente qué hay que hacer** para abrir y usar la página de **Click-Go** desde un celular usando **el mismo código del proyecto**, sin subirla a Vercel/Render y **sin necesitar internet**.

---

## 💡 ¿Por qué no funciona solo con `localhost` en el celular?

Cuando corres la página en tu computadora, normalmente entras a `http://localhost:5173`.
- En la computadora, `localhost` significa **"esta misma computadora"**.
- Si escribes `localhost` en el celular, el celular se busca **a sí mismo**, no a tu computadora.

Para que el celular encuentre la página alojada en la computadora, hay que cumplir **5 cosas clave**:
1. Que ambos dispositivos estén en la **misma red Wi-Fi / router**.
2. Que el servidor escuche en la **red local** (`0.0.0.0`), no solo en `localhost` *(tu proyecto ya lo trae activado)*.
3. Que el **Firewall de Windows** deje pasar conexiones al puerto **`5173`** (y `3001`).
4. Conocer la **dirección IP** de la computadora servidor (ej. `192.168.2.13`).
5. **Apagar los datos móviles** en el celular si la red del router no tiene internet.

---

## ✅ Opción 1 (La más fácil y directa): Usar el mismo código con `npm run dev`

Esta opción no requiere cambiar nada del código ni hacer deploy. Tu archivo `vite.config.js` **ya está preparado** para levantar tanto la página web (React) como la conexión a MySQL (`server.js`) con un solo comando y expuesto a la red local (`host: true`).

### Paso 1: Requisitos en la computadora servidor (PC de Alejandra)
1. Tener instalado **Node.js** (versión 18 o superior) y **XAMPP**.
2. Copiar la carpeta del proyecto (`Dani`) en la computadora.
3. Abrir una terminal dentro de la carpeta del proyecto y ejecutar **solo la primera vez**:
   ```bash
   npm install
   ```

### Paso 2: Revisar el archivo `.env` y encender MySQL
1. Abre **XAMPP Control Panel** y da clic en **Start** en **MySQL** (debe quedar en verde).
2. En la raíz del proyecto, abre (o crea) el archivo `.env` y verifica que `DB_NAME` tenga el nombre exacto de tu base de datos en phpMyAdmin (`pitufibase` o `clickgo`):
   ```env
   PORT=3001
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=pitufibase
   DB_SSL=false
   ```

### Paso 3: Abrir el puerto `5173` (y `3001`) en el Firewall de Windows
> [!IMPORTANT]
> Este es el paso que casi siempre falta. Sin esto, la página abre bien en la PC pero **nunca carga en el celular**.

#### Forma rápida (PowerShell como Administrador):
1. Clic derecho en el botón de **Inicio** -> **Terminal (Administrador)** o **Windows PowerShell (Administrador)**.
2. Ejecuta estos dos comandos:
   ```powershell
   New-NetFirewallRule -DisplayName "ClickGo Vite 5173" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Any
   New-NetFirewallRule -DisplayName "ClickGo API 3001" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow -Profile Any
   ```

#### Forma manual (Interfaz gráfica):
1. Presiona `Win + R`, escribe **`wf.msc`** y presiona **Enter**.
2. Clic en **Reglas de entrada** -> **Nueva regla...**
3. Selecciona **Puerto** -> **TCP** -> **Puertos locales específicos:** `5173, 3001` -> **Siguiente**.
4. Selecciona **Permitir la conexión** -> **Siguiente**.
5. Marca las 3 casillas (**Dominio**, **Privado**, **Público**) -> **Siguiente**.
6. Ponle de nombre `ClickGo Web Local` -> **Finalizar**.

### Paso 4: Averiguar la IP de la computadora y arrancar el servidor
1. Conecta la computadora al **mismo router / Wi-Fi** que usará el celular.
2. En la terminal, dentro de la carpeta del proyecto, corre:
   ```bash
   npm run dev
   ```
3. Verás una salida parecida a esta:
   ```text
     VITE v5.x.x  ready in 300 ms

     ➜  Local:   http://localhost:5173/
     ➜  Network: http://192.168.2.13:5173/
   ```
   - La dirección **`Network`** (por ejemplo `http://192.168.2.13:5173/`) es la que debes abrir en el celular.
   - *(Si quieres confirmar tu IP en Windows, abre `cmd`, escribe `ipconfig` y busca **Dirección IPv4**).*
   - **No cierres esta terminal** mientras estén usando la página.

### Paso 5: Conectarse desde el celular
1. Conecta el celular al **mismo Wi-Fi** del router.
2. **Apaga los datos móviles (4G / 5G)** del celular.
   > Si el router del laboratorio no tiene internet y dejas los datos móviles prendidos, el celular ignora el Wi-Fi y nunca encontrará `192.168.2.13`.
3. Si el celular pregunta *"Esta red Wi-Fi no tiene internet, ¿permanecer conectado?"*, elige **Sí / Mantener conexión**.
4. Abre Chrome o Safari y escribe **exactamente** la dirección `Network` empezando con **`http://`** (sin `s`):
   ```text
   http://192.168.2.13:5173
   ```
5. ¡Listo! Ya puedes usar la aplicación desde el celular y los pedidos se guardarán en MySQL en tiempo real.

---

## 🔁 Opción 2 (Alternativa): Servir la página directo desde XAMPP (`htdocs`) sin usar `npm run dev`

Si prefieres **no dejar abierto `npm run dev`** en la PC de Alejandra (por ejemplo, si solo quieren tener XAMPP encendido en el puerto `80`):

1. En cualquier PC con Node.js, dentro del proyecto, compila la página una sola vez:
   ```bash
   npm run build
   ```
   Esto genera una carpeta llamada **`dist/`** con los archivos estáticos listos (`index.html`, JS, CSS e imágenes).
2. Copia el **contenido** de la carpeta `dist/` dentro de `C:\xampp\htdocs\clickgo\` en la PC de Alejandra.
3. Enciende **Apache** y **MySQL** en XAMPP y asegúrate de tener abierto el puerto **`80`** en el Firewall (ver `GUIA_FIREWALL_Y_XAMPP.md`).
4. En el celular entra a:
   ```text
   http://192.168.2.13/clickgo/
   ```
   *(Nota: con esta opción el backend `/api` ya no corre dentro de Vite, así que debes dejar corriendo `npm run server` en puerto `3001`, o bien apuntar `src/plcConnection.js` a los archivos de `php_api/` en Apache).*

---

## 🛠️ Solución rápida si el celular no carga la página

| Síntoma en el celular | Qué revisar |
| :--- | :--- |
| **"No se puede acceder a este sitio" / `ERR_CONNECTION_TIMED_OUT`** | 1. Apaga los **datos móviles** del celular.<br>2. Revisa que la regla del **Firewall** incluya el puerto `5173` en perfil **Público y Privado**.<br>3. Verifica que el celular y la PC estén en el **mismo Wi-Fi**. |
| **El navegador cambia a `https://` y marca error de seguridad** | Borra la `s` y escribe manualmente **`http://192.168.2.13:5173`**. |
| **La página abre, pero no guarda pedidos ni lee disponibilidad** | 1. Revisa que **MySQL** esté en verde en XAMPP.<br>2. Verifica que `DB_NAME` en `.env` coincida con el nombre de tu BD (`pitufibase` o `clickgo`).<br>3. Revisa la terminal de `npm run dev` para ver el mensaje exacto del error. |
| **Solo aparece `Local:` y no aparece `Network:` al correr `npm run dev`** | Ejecuta `npx vite --host 0.0.0.0` para forzar que escuche en toda la red local. |
