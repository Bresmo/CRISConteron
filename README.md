# CRIS Conterón · Hair Studio
Plataforma web profesional para salones de belleza y peluquerías de alta gama, desarrollada con un estándar estricto de producción en **HTML5, CSS3, JavaScript Vanilla (ES Modules)** y **Supabase (PostgreSQL + RLS)**.

---

## 🛠️ Stack Tecnológico
- **Front-end:** HTML5, CSS3 (Variables CSS centralizadas para fácil rebranding), JavaScript Vanilla (ES Modules). Sin frameworks ni pasos de compilación (*build steps*).
- **Backend & Base de Datos:** Supabase (Postgres, Auth, Storage, RLS), utilizando `@supabase/supabase-js` v2 por CDN (JSDelivr).
- **Gráficos & Librerías:** Chart.js (Reportes financieros) y Phosphor Icons por CDN.
- **Hosting:** Netlify (Sitio estático).

---

## 📂 Estructura de Carpetas
```text
/
├── index.html                  (Sitio público: Hero, servicios, equipo, galería, testimonios, ubicación)
├── reservar.html               (Flujo de reserva interactiva en 4 pasos)
├── admin/
│   ├── login.html              (Acceso autenticado seguro)
│   ├── dashboard.html          (Métricas del día y gráficos de ingresos)
│   ├── servicios.html          (CRUD de categorías, servicios e imágenes)
│   ├── equipo.html             (CRUD de estilistas, comisiones y rendimiento)
│   ├── citas.html              (Gestión de agenda y estados de reservas)
│   ├── contabilidad.html       (Finanzas, gastos, filtros por periodo y cierre de caja)
│   ├── clientes.html           (Directorio de clientes e historial de consumo)
│   └── configuracion.html      (Parámetros y textos globales del negocio)
├── css/
│   ├── variables.css           (Paleta de colores, tipografías y espaciados)
│   ├── base.css                (Reset global y utilidades)
│   ├── publico.css             (Estilos y flujo de reserva pública)
│   └── admin.css               (Estilos del panel de control y modales)
├── js/
│   ├── supabaseClient.js       (Inicialización del cliente Supabase)
│   ├── config.example.js       (Plantilla de configuración; renombrar a config.js)
│   ├── auth.js                 (Protección de rutas administrativas y sesión)
│   ├── publico/                (Módulos de servicios, equipo y reservas)
│   └── admin/                  (Utilidades del panel admin)
├── supabase/
│   ├── schema.sql              (Tablas relacionales, triggers automáticos y funciones RPC)
│   ├── policies.sql            (Políticas de Row Level Security y Storage)
│   └── seed.sql                (Datos de ejemplo históricos)
├── assets/img/
├── netlify.toml                (Reglas de redirección para SPA/estático)
├── .gitignore                  (Exclusión de credenciales y archivos locales)
└── README.md                   (Documentación del proyecto)