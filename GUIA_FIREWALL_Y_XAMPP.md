# 🔥 Guía de Configuración: API PHP en XAMPP + Firewall de Windows (Puertos 80 y 3306)

Esta guía explica paso a paso cómo instalar los archivos `.php` en la computadora servidor (PC de Alejandra con XAMPP), cómo abrir los puertos **`80` (Apache)** y **`3306` (MySQL)** en el **Firewall de Windows**, y cómo probar la conexión desde el celular y SCADA contra la base de datos **`pitufibase`**.

---

## 1. Instalar los archivos `.php` en XAMPP (`htdocs`)

1. En la PC de Alejandra, ubica la carpeta de instalación de XAMPP (normalmente **`C:\xampp\htdocs\`**).
2. Copia la carpeta completa **`php_api`** de este proyecto dentro de `C:\xampp\htdocs\`, de modo que quede así:

```text
C:\xampp\htdocs\php_api\
├── config.php
├── health.php
├── crear_pedido.php
├── leer_estado.php
├── actualizar_estado.php
├── consultar_disponibilidad.php
├── actualizar_disponibilidad.php
├── ultimo_pedido.php
└── cancelar_pedido.php
```

3. Abre **`C:\xampp\htdocs\php_api\config.php`** con el Bloc de Notas o VS Code y verifica que los datos coincidan con el MySQL de XAMPP:
   ```php
   define('DB_HOST', '127.0.0.1');
   define('DB_PORT', 3306);
   define('DB_NAME', 'pitufibase'); // Cambiar si tu base de datos tiene otro nombre
   define('DB_USER', 'root');
   define('DB_PASS', '');
   ```
4. Abre **XAMPP Control Panel** (clic derecho -> *Ejecutar como administrador*) y presiona **Start** en **Apache** y **MySQL** hasta que ambos estén en **verde**.

---

## 2. Configurar el Firewall de Windows (Puertos `80` y `3306`)

Por seguridad, Windows bloquea por defecto las peticiones que llegan desde otros dispositivos de la red (como el celular o el SCADA). Tienes **3 opciones**; elige la que te resulte más cómoda (la **Opción A** o la **Opción B** son las recomendadas porque dejan tu Firewall activo y solo abren los dos puertos necesarios).

---

### ✅ Opción A (Recomendada): Crear reglas paso a paso (Interfaz Gráfica)

#### Paso 1: Abrir el Firewall avanzado
1. Presiona la tecla **Windows** (o `Win + R`).
2. Escribe **`wf.msc`** y presiona **Enter**.
   *(También puedes buscar "Firewall de Windows Defender con seguridad avanzada" en el menú Inicio).*
3. En el panel izquierdo, haz clic en **Reglas de entrada** (*Inbound Rules*).

#### Paso 2: Abrir el puerto `80` (Apache / PHP)
1. En el panel derecho, haz clic en **Nueva regla...** (*New Rule...*).
2. Selecciona **Puerto** (*Port*) y haz clic en **Siguiente**.
3. Selecciona **TCP** y en **Puertos locales específicos** escribe:
   ```text
   80
   ```
   Haz clic en **Siguiente**.
4. Selecciona **Permitir la conexión** (*Allow the connection*) y haz clic en **Siguiente**.
5. Deja marcadas las 3 casillas (**Dominio**, **Privado** y **Público**) para evitar bloqueos si Windows clasifica el router del laboratorio como red pública. Haz clic en **Siguiente**.
6. En **Nombre**, escribe:
   ```text
   XAMPP Apache Puerto 80
   ```
   Haz clic en **Finalizar**.

#### Paso 3: Abrir el puerto `3306` (MySQL / `pitufibase`)
1. Repite exactamente el mismo proceso: en el panel derecho haz clic en **Nueva regla...**.
2. Selecciona **Puerto** -> **Siguiente**.
3. Selecciona **TCP** y en **Puertos locales específicos** escribe:
   ```text
   3306
   ```
   Haz clic en **Siguiente**.
4. Selecciona **Permitir la conexión** -> **Siguiente**.
5. Deja marcadas las 3 casillas (**Dominio**, **Privado**, **Público**) -> **Siguiente**.
6. En **Nombre**, escribe:
   ```text
   XAMPP MySQL Puerto 3306
   ```
   Haz clic en **Finalizar**.

> [!TIP]
> También puedes crear una sola regla escribiendo `80, 3306` en *Puertos locales específicos*, pero crearlas por separado hace más fácil activar/desactivar cada servicio después.

---

### ⚡ Opción B (Más rápida): Abrir ambos puertos en 5 segundos con PowerShell

1. Haz clic derecho en el botón de **Inicio** de Windows y selecciona **Terminal (Administrador)** o **Windows PowerShell (Administrador)**.
2. Copia, pega y ejecuta estos dos comandos:

```powershell
New-NetFirewallRule -DisplayName "XAMPP Apache Puerto 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "XAMPP MySQL Puerto 3306" -Direction Inbound -Protocol TCP -LocalPort 3306 -Action Allow -Profile Any
```

3. Para confirmar que las reglas se crearon correctamente, ejecuta:
```powershell
Get-NetFirewallRule -DisplayName "XAMPP*" | Format-Table DisplayName, Enabled, Direction, Action
```

*(Si después de la entrega quieres cerrar los puertos, solo ejecuta en PowerShell como Administrador:)*
```powershell
Remove-NetFirewallRule -DisplayName "XAMPP Apache Puerto 80"
Remove-NetFirewallRule -DisplayName "XAMPP MySQL Puerto 3306"
```

---

### 🚨 Opción C (Plan B de emergencia en la presentación)

Si por alguna política de Windows sigue sin pasar el tráfico durante la demo:
1. Busca **Firewall de Windows Defender** en el menú Inicio.
2. En el menú izquierdo, clic en **Activar o desactivar Firewall de Windows Defender**.
3. Marca **Desactivar** en *Red privada* (y en *Red pública* si Windows clasificó el router como red pública) y presiona **Aceptar**.
4. **Recuerda volver a activarlo** al terminar la presentación.

---

## 3. Permitir conexiones remotas en MySQL (Puerto `3306`)

Abrir el puerto `3306` en el Firewall permite que los paquetes lleguen a la PC, pero **MySQL también debe dar permiso** al usuario `root` para conectarse desde otra IP (por ejemplo SCADA en `192.168.2.50`):

1. En la PC de Alejandra, abre `http://localhost/phpmyadmin`.
2. Ve a la pestaña **SQL** y ejecuta:
   ```sql
   GRANT ALL PRIVILEGES ON pitufibase.* TO 'root'@'%' IDENTIFIED BY '';
   FLUSH PRIVILEGES;
   ```
   *(Si tu versión de MariaDB/MySQL marca error de sintaxis con `IDENTIFIED BY ''`, usa en su lugar:)*
   ```sql
   CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY '';
   GRANT ALL PRIVILEGES ON pitufibase.* TO 'root'@'%';
   FLUSH PRIVILEGES;
   ```
3. Verifica en XAMPP Control Panel -> botón **Config** de MySQL -> **`my.ini`** que **NO** exista una línea activa que diga `bind-address = 127.0.0.1`. Si existe, coméntala poniendo un `#` al inicio (`#bind-address = 127.0.0.1`) o cámbiala a `bind-address = 0.0.0.0`, guarda y reinicia MySQL.

---

## 4. Probar los archivos PHP y usarlos con `fetch()`

Supongamos que la IP de la PC de Alejandra en el router es **`192.168.2.13`** (puedes confirmarla abriendo `cmd` y escribiendo `ipconfig`, buscando **Dirección IPv4**).

### Prueba rápida en el navegador (primero en la PC, luego en el celular)
> **Nota en el celular:** Conéctate al Wi-Fi del router y **apaga los datos móviles (4G/5G)**.

1. **Verificar conexión a `pitufibase`:**
   ```text
   http://192.168.2.13/php_api/health.php
   ```
   Debe responder:
   ```json
   {"success":true,"status":"ok","db":"connected","database":"pitufibase"}
   ```

2. **Leer estado de estaciones:**
   ```text
   http://192.168.2.13/php_api/leer_estado.php
   ```

3. **Consultar disponibilidad de piezas:**
   ```text
   http://192.168.2.13/php_api/consultar_disponibilidad.php
   ```

### Ejemplos de `fetch()` desde JavaScript

```javascript
const API_BASE = 'http://192.168.2.13/php_api';

// 1. Crear pedido (1 = Electrónica, 2 = Arte, 3 = Juguetes)
const resPedido = await fetch(`${API_BASE}/crear_pedido.php`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id_categoria: 1 })
});
const dataPedido = await resPedido.json();

// 2. Leer estado actual de las estaciones
const resEstado = await fetch(`${API_BASE}/leer_estado.php`);
const { estado } = await resEstado.json();

// 3. Consultar disponibilidad de piezas
const resDisp = await fetch(`${API_BASE}/consultar_disponibilidad.php`);
const { categoria_piezas, almacen } = await resDisp.json();
```

---

## 5. Resumen de todos los endpoints creados

| Archivo `.php` | Método | Descripción |
| :--- | :--- | :--- |
| `config.php` | *(interno)* | Conexión PDO a `pitufibase`, headers CORS y utilidades JSON |
| `health.php` | `GET` | Verifica que Apache + PHP + MySQL respondan correctamente |
| `crear_pedido.php` | `POST` | Inserta nuevo pedido en `pedido_historico` y reinicia `Estado` a `1` |
| `leer_estado.php` | `GET` | Lee `Estado` actual y libera `en_espera = 0` si terminó (`2`) o hay error (`4`) |
| `actualizar_estado.php` | `PUT` / `POST` | Actualiza manualmente estaciones en `Estado` y registra alarmas si hay `4` |
| `consultar_disponibilidad.php` | `GET` | Devuelve tablas `categoria_piezas` y `Almacen` |
| `actualizar_disponibilidad.php` | `PUT` / `POST` | Actualiza `Almacen.disponible` y recalcula `categoria_piezas.cantidad` |
| `ultimo_pedido.php` | `GET` | Devuelve el último registro de `pedido_historico` |
| `cancelar_pedido.php` | `POST` | Cancela pedido activo (`en_espera = 0`) y guarda alarma en `alarmas` |

---

## 6. Solución rápida de problemas

| Problema | Causa probable | Solución |
| :--- | :--- | :--- |
| En el celular dice `ERR_CONNECTION_TIMED_OUT` | Datos móviles prendidos o Firewall bloqueando puerto 80 | Apaga datos móviles en el celular y verifica que la regla del puerto `80` tenga marcado **Público** y **Privado**. |
| `health.php` responde `Unknown database 'pitufibase'` | La BD en phpMyAdmin tiene otro nombre (ej. `clickgo`) | Abre `config.php` y cambia `DB_NAME` al nombre exacto de tu base de datos. |
| Apache no arranca en XAMPP | Otro programa (IIS, Skype, VMware) usa el puerto 80 | Cambia el puerto en `httpd.conf` (ej. `8080`), abre `8080` en el Firewall y usa `http://192.168.2.13:8080/php_api/...`. |
| SCADA no se conecta a MySQL (`3306`) | Falta permiso remoto en MySQL o `bind-address` restringido | Ejecuta el `GRANT ALL PRIVILEGES` de la Sección 3 y revisa `my.ini`. |
