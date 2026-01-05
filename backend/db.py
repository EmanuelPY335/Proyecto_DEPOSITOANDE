# sisdepo/backend/db.py
import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

# 1. Inicializar SQLAlchemy
db = SQLAlchemy()

# ---------------------------------------------------------
# TABLAS INTERMEDIAS Y PERMISOS
# ---------------------------------------------------------

# Tabla de asociación (Muchos a Muchos) para Roles y Permisos
permiso_x_rol = db.Table('permiso_x_rol',
    db.Column('ID_ROL', db.Integer, db.ForeignKey('rol.ID_ROL'), primary_key=True),
    db.Column('ID_PERMISO', db.Integer, db.ForeignKey('permiso.ID_PERMISO'), primary_key=True)
)

class Permiso(db.Model):
    __tablename__ = 'permiso'
    ID_PERMISO = db.Column(db.Integer, primary_key=True)
    NOMBRE_PERMISO = db.Column(db.String(60), unique=True, nullable=False)
    DESCRIPCION = db.Column(db.String(255))

# ---------------------------------------------------------
# MODELOS DE USUARIO Y PERSONAL
# ---------------------------------------------------------

class Rol(db.Model):
    __tablename__ = 'rol'
    ID_ROL = db.Column(db.Integer, primary_key=True)
    NOMBRE_ROL = db.Column(db.String(60))
    DESCRIPCION_ROL = db.Column(db.String(255))

    # RELACIONES
    # 1. Permisos (Muchos a Muchos)
    permisos = db.relationship('Permiso', secondary=permiso_x_rol, backref=db.backref('roles', lazy='dynamic'))
    
    # 2. Usuarios (Uno a Muchos) - CORREGIDO: Usamos back_populates para evitar conflicto
    usuarios = db.relationship('Usuario', back_populates='rol', lazy=True)

# En backend/db.py

class Deposito(db.Model):
    __tablename__ = 'deposito'
    ID_DEPOSITO = db.Column(db.Integer, primary_key=True)
    NOMBRE = db.Column(db.String(60))
    DIRECCION = db.Column(db.String(100)) # Aumentamos un poco el tamaño por si acaso
    
    # --- NUEVOS CAMPOS DE UBICACIÓN ---
    LATITUD = db.Column(db.Float, nullable=True)
    LONGITUD = db.Column(db.Float, nullable=True)
    # ----------------------------------

    # Relaciones
    inventario_items = db.relationship('Inventario', backref='deposito', lazy=True)

    def to_dict(self):
        return {
            "ID_DEPOSITO": self.ID_DEPOSITO, 
            "NOMBRE": self.NOMBRE,
            "DIRECCION": self.DIRECCION,
            "LATITUD": self.LATITUD,
            "LONGITUD": self.LONGITUD
        }

class Empleado(db.Model):
    __tablename__ = 'empleado'
    ID_EMPLEADO = db.Column(db.Integer, primary_key=True)
    ID_DEPOSITO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'))
    NUMERO_DOCUMENTO = db.Column(db.Integer)
    NOMBRE = db.Column(db.String(60))
    APELLIDO = db.Column(db.String(60))
    ESTADO_ACTIVO = db.Column(db.Boolean, default=True)
    TELEFONO = db.Column(db.BigInteger)
    FECHA_NACIMIENTO = db.Column(db.Date, nullable=True)

    # Relaciones
    usuario = db.relationship('Usuario', back_populates='empleado', uselist=False)
    # Nota: Deposito no tiene back_populates explicito aquí, pero está bien.

class Usuario(db.Model):
    __tablename__ = 'usuario'
    ID_USUARIO = db.Column(db.Integer, primary_key=True)
    ID_ROL = db.Column(db.Integer, db.ForeignKey('rol.ID_ROL'))
    ID_EMPLEADO = db.Column(db.Integer, db.ForeignKey('empleado.ID_EMPLEADO'), unique=True)
    
    CORREO = db.Column(db.String(80), unique=True, nullable=False)
    CONTRASENA = db.Column(db.String(255), nullable=False)
    
    # Campos de perfil
    AVATAR = db.Column(db.String(255)) 
    BANNER_COLOR = db.Column(db.String(20), default='#5865F2')

    # Relaciones
    empleado = db.relationship('Empleado', back_populates='usuario')
    
    # CORREGIDO: Usamos back_populates para conectar con Rol.usuarios
    rol = db.relationship('Rol', back_populates='usuarios')

    def set_password(self, password):
        self.CONTRASENA = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.CONTRASENA, password)
    
    def to_dict_profile(self):
        if not self.empleado:
            return {"CORREO": self.CORREO}
        return {
            "ID_EMPLEADO": self.empleado.ID_EMPLEADO,
            "NOMBRE": self.empleado.NOMBRE,
            "APELLIDO": self.empleado.APELLIDO,
            "TELEFONO": self.empleado.TELEFONO,
            "CORREO": self.CORREO,
            "AVATAR": self.AVATAR,
            "BANNER_COLOR": self.BANNER_COLOR
        }

class PasswordResetToken(db.Model):
    __tablename__ = 'password_reset_tokens'
    TOKEN = db.Column(db.String(64), primary_key=True) 
    EMAIL = db.Column(db.String(255), nullable=False)
    EXPIRES_AT = db.Column(db.DateTime, nullable=False)

# ---------------------------------------------------------
# MODELOS DE INVENTARIO Y LOTES
# ---------------------------------------------------------

class Material(db.Model):
    __tablename__ = 'material'
    ID_MATERIAL = db.Column(db.Integer, primary_key=True)
    CODIGO_UNICO = db.Column(db.Integer, unique=True) 
    NOMBRE = db.Column(db.String(100))
    CANTIDAD = db.Column(db.Float, default=0.0)
    UNIDAD_MEDIDA = db.Column(db.String(20)) 
    CATEGORIA = db.Column(db.String(50)) 
    STOCK_MINIMO = db.Column(db.Float, default=5.0)

    # Relación con Lotes
    lotes = db.relationship('Lote', backref='material', lazy=True)

    def to_dict(self):
        return {
            "ID_MATERIAL": self.ID_MATERIAL, 
            "CODIGO_UNICO": self.CODIGO_UNICO, 
            "NOMBRE": self.NOMBRE,
            "CANTIDAD": self.CANTIDAD,
            "UNIDAD": self.UNIDAD_MEDIDA,
            "CATEGORIA": self.CATEGORIA,
            "STOCK_MINIMO": self.STOCK_MINIMO
        }

class Lote(db.Model):
    __tablename__ = 'lote'
    ID_LOTE = db.Column(db.Integer, primary_key=True)
    ID_MATERIAL = db.Column(db.Integer, db.ForeignKey('material.ID_MATERIAL'), nullable=False)
    FECHA_INGRESO = db.Column(db.Date, default=datetime.date.today)
    OBSERVACIONES = db.Column(db.String(254))

    # La relación 'material' se crea con el backref en Material

class EstadoInventario(db.Model):
    __tablename__ = 'estado_inventario'
    ID_ESTADO_INVENTARIO = db.Column(db.Integer, primary_key=True)
    ESTADO_INVENTARIO = db.Column(db.String(60))

class Inventario(db.Model):
    __tablename__ = 'inventario'
    ID_INVENTARIO = db.Column(db.Integer, primary_key=True)
    ID_DEPOSITO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)
    ID_LOTE = db.Column(db.Integer, db.ForeignKey('lote.ID_LOTE'), nullable=False)
    ID_ESTADO_INVENTARIO = db.Column(db.Integer, db.ForeignKey('estado_inventario.ID_ESTADO_INVENTARIO'), nullable=False)
    CANTIDAD_ACTUAL = db.Column(db.Float, default=0)

    # Relaciones
    # Deposito backref definido arriba
    lote = db.relationship('Lote', backref='inventarios')
    estado = db.relationship('EstadoInventario')

    def to_dict(self):
        return {
            "id_inventario": self.ID_INVENTARIO,
            "material": self.lote.material.NOMBRE,
            "codigo": self.lote.material.CODIGO_UNICO,
            "lote_id": self.ID_LOTE,
            "fecha_ingreso": self.lote.FECHA_INGRESO.strftime('%Y-%m-%d') if self.lote.FECHA_INGRESO else None,
            "deposito": self.deposito.NOMBRE,
            "cantidad": self.CANTIDAD_ACTUAL,
            "estado": self.estado.ESTADO_INVENTARIO if self.estado else "Desconocido"
        }

# ---------------------------------------------------------
# MODELOS DE MOVIMIENTOS
# ---------------------------------------------------------

class TipoMovimiento(db.Model):
    __tablename__ = 'tipo_movimiento'
    ID_TIPO_MOVIMIENTO = db.Column(db.Integer, primary_key=True)
    TIPO_MOVIMIENTO = db.Column(db.String(40))

class MovimientoMaterial(db.Model):
    __tablename__ = 'movimiento_material'
    ID_MOVIMIENTO = db.Column(db.Integer, primary_key=True)
    # ... (tus columnas existentes) ...
    ID_TIPO_MOVIMIENTO = db.Column(db.Integer, db.ForeignKey('tipo_movimiento.ID_TIPO_MOVIMIENTO'), nullable=False)
    ID_EMPLEADO = db.Column(db.Integer, db.ForeignKey('empleado.ID_EMPLEADO'), nullable=False)
    ID_DEPOSITO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)
    ID_LOTE = db.Column(db.Integer, db.ForeignKey('lote.ID_LOTE'), nullable=False)
    
    # --- [NUEVO CAMPO] ---
    # Vincula el movimiento de stock con el documento de traslado
    ID_VALE = db.Column(db.Integer, db.ForeignKey('vale.ID_VALE'), nullable=True) 
    # ---------------------

    FECHA_MOVIMIENTO = db.Column(db.Date, default=datetime.date.today)
    CANTIDAD = db.Column(db.Float)
    OBSERVACIONES = db.Column(db.String(254))

    # Relaciones
    tipo = db.relationship('TipoMovimiento')
    empleado = db.relationship('Empleado')
    deposito = db.relationship('Deposito')
    lote = db.relationship('Lote')
    # Relación opcional con vale
    vale = db.relationship('Vale')

# ---------------------------------------------------------
# MODELOS DE VEHÍCULOS Y GPS
# ---------------------------------------------------------

class Vehiculo(db.Model):
    __tablename__ = "vehiculo"
    ID_VEHICULO = db.Column(db.Integer, primary_key=True)
    ID_EMPLEADO = db.Column(db.Integer, db.ForeignKey("empleado.ID_EMPLEADO"), nullable=False)
    MATRICULA = db.Column(db.String(10), nullable=False, unique=True)
    MARCA = db.Column(db.String(40))
    MODELO = db.Column(db.String(30))
    
    posiciones = db.relationship('PosicionGps', backref='vehiculo', lazy=True)

class PosicionGps(db.Model):
    __tablename__ = "registro_gps"
    ID_REGISTRO_GPS = db.Column(db.Integer, primary_key=True)
    ID_VEHICULO = db.Column(db.Integer, db.ForeignKey("vehiculo.ID_VEHICULO"), nullable=False)
    LATITUD = db.Column(db.DECIMAL(10, 7))
    LONGITUD = db.Column(db.DECIMAL(10, 7))
    FECHA_HORA = db.Column(db.DateTime, default=datetime.datetime.now)

# ---------------------------------------------------------
# MODELOS DE GESTIÓN (Asistencia y Órdenes)
# ---------------------------------------------------------

class Asistencia(db.Model):
    __tablename__ = 'asistencia'
    ID_ASISTENCIA = db.Column(db.Integer, primary_key=True)
    ID_EMPLEADO = db.Column(db.Integer, db.ForeignKey('empleado.ID_EMPLEADO'), nullable=False)
    FECHA = db.Column(db.Date, default=datetime.date.today)
    HORA_ENTRADA = db.Column(db.Time, nullable=True)
    HORA_SALIDA = db.Column(db.Time, nullable=True)
    OBSERVACION = db.Column(db.String(255))

    empleado = db.relationship('Empleado', backref='asistencias')

class EstadoOrden(db.Model):
    __tablename__ = 'estado_orden'
    ID_ESTADO_ORDEN = db.Column(db.Integer, primary_key=True)
    ESTADO_ORDEN = db.Column(db.String(40))

class OrdenTrabajo(db.Model):
    __tablename__ = 'orden_trabajo'
    ID_ORDEN = db.Column(db.Integer, primary_key=True)
    
    # Relaciones
    ID_ESTADO_ORDEN = db.Column(db.Integer, db.ForeignKey('estado_orden.ID_ESTADO_ORDEN'), nullable=False)
    ID_DEPOSITO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)
    ID_EMPLEADO = db.Column(db.Integer, db.ForeignKey('empleado.ID_EMPLEADO'), nullable=False)
    
    # Datos Generales
    TITULO = db.Column(db.String(100), nullable=False)
    DESCRIPCION = db.Column(db.Text) 
    PRIORIDAD = db.Column(db.String(20), default="Media") 
    
    FECHA_INICIO = db.Column(db.DateTime) 
    FECHA_CIERRE = db.Column(db.DateTime) 
    FECHA_LIMITE = db.Column(db.DateTime, nullable=True) 

    HERRAMIENTAS = db.Column(db.Text, nullable=True)
    TIEMPO_EMPLEADO = db.Column(db.String(50), nullable=True)
    ELIMINADA = db.Column(db.Boolean, default=False)

    # --- NUEVOS CAMPOS PARA MOVIMIENTOS (AQUÍ ESTABA EL ERROR) ---
    TIPO_ORDEN = db.Column(db.String(20), default="General")
    ID_LOTE_OBJETIVO = db.Column(db.Integer, db.ForeignKey('lote.ID_LOTE'), nullable=True)
    CANTIDAD_MOVIMIENTO = db.Column(db.Float, default=0)
    NUEVA_UBICACION = db.Column(db.String(100), nullable=True)
    # -------------------------------------------------------------

    # Relaciones SQL
    estado = db.relationship('EstadoOrden')
    deposito = db.relationship('Deposito')
    empleado = db.relationship('Empleado', backref='ordenes_asignadas')
    avances = db.relationship('AvanceOrden', backref='orden', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.ID_ORDEN,
            "titulo": self.TITULO,
            "descripcion": self.DESCRIPCION,
            "estado": self.estado.ESTADO_ORDEN if self.estado else "Desconocido",
            "estado_id": self.ID_ESTADO_ORDEN,
            "prioridad": self.PRIORIDAD,
            "fecha_inicio": self.FECHA_INICIO.strftime("%d/%m/%Y %H:%M") if self.FECHA_INICIO else None,
            "fecha_cierre": self.FECHA_CIERRE.strftime("%d/%m/%Y %H:%M") if self.FECHA_CIERRE else None,
            "fecha_limite": self.FECHA_LIMITE.strftime("%Y-%m-%dT%H:%M") if self.FECHA_LIMITE else "",
            "fecha_limite_fmt": self.FECHA_LIMITE.strftime("%d/%m/%Y %H:%M") if self.FECHA_LIMITE else None,
            "herramientas": self.HERRAMIENTAS or "",
            "tiempo_empleado": self.TIEMPO_EMPLEADO or "",
            "deposito": self.deposito.NOMBRE if self.deposito else "-",
            "deposito_id": self.ID_DEPOSITO,
            "empleado_nombre": f"{self.empleado.NOMBRE} {self.empleado.APELLIDO}" if self.empleado else "Sin asignar",
            "empleado_id": self.ID_EMPLEADO,
            "empleado_avatar": self.empleado.usuario.AVATAR if (self.empleado and self.empleado.usuario) else None,
            
            # Datos Movimiento
            "tipo_orden": self.TIPO_ORDEN,
            "cantidad_mov": self.CANTIDAD_MOVIMIENTO,
            "nueva_ubicacion": self.NUEVA_UBICACION
        }

class AvanceOrden(db.Model):
    __tablename__ = 'avance_orden'
    ID_AVANCE = db.Column(db.Integer, primary_key=True)
    ID_ORDEN = db.Column(db.Integer, db.ForeignKey('orden_trabajo.ID_ORDEN'), nullable=False)
    AUTOR = db.Column(db.String(100)) 
    MENSAJE = db.Column(db.Text, nullable=False)
    FECHA_HORA = db.Column(db.DateTime, default=datetime.datetime.now)

    def to_dict(self):
        return {
            "id": self.ID_AVANCE,
            "autor": self.AUTOR,
            "mensaje": self.MENSAJE,
            "fecha": self.FECHA_HORA.strftime("%d/%m/%Y %H:%M")
        }
# ------------PEDIDOS------------
# Agregar en backend/db.py

# [backend/db.py] - Agregar al final

class EstadoSolicitud(db.Model):
    __tablename__ = 'estado_solicitud'
    ID_ESTADO = db.Column(db.Integer, primary_key=True)
    NOMBRE = db.Column(db.String(50)) # 1: Pendiente, 2: En Preparación, 3: En Tránsito, 4: Recibido, 5: Rechazado

class SolicitudMaterial(db.Model):
    __tablename__ = 'solicitud_material'
    ID_SOLICITUD = db.Column(db.Integer, primary_key=True)
    
    # ¿Quién pide? (El que necesita el material)
    ID_DEPOSITO_SOLICITANTE = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)
    ID_USUARIO_SOLICITANTE = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=False)
    
    # ¿A quién le pide? (El que tiene el stock)
    ID_DEPOSITO_PROVEEDOR = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)
    
    # ¿Qué pide? (Material genérico, no lote específico aún)
    ID_MATERIAL = db.Column(db.Integer, db.ForeignKey('material.ID_MATERIAL'), nullable=False)
    CANTIDAD = db.Column(db.Float, nullable=False)
    
    # Control de flujo
    ID_ESTADO = db.Column(db.Integer, db.ForeignKey('estado_solicitud.ID_ESTADO'), default=1)
    FECHA_SOLICITUD = db.Column(db.DateTime, default=datetime.datetime.now)
    FECHA_CIERRE = db.Column(db.DateTime, nullable=True)
    OBSERVACION = db.Column(db.String(255))

    # --- CAMPOS PARA EL FUTURO (Multi-encargo y Camiones) ---
    # Cuando se apruebe y se asigne a un camión, llenaremos esto:
    ID_VEHICULO_ASIGNADO = db.Column(db.Integer, db.ForeignKey('vehiculo.ID_VEHICULO'), nullable=True)
    # Cuando salga físicamente del depósito proveedor:
    ID_MOVIMIENTO_SALIDA = db.Column(db.Integer, db.ForeignKey('movimiento_material.ID_MOVIMIENTO'), nullable=True)

    # Relaciones
    material = db.relationship('Material')
    estado = db.relationship('EstadoSolicitud')
    dep_solicitante = db.relationship('Deposito', foreign_keys=[ID_DEPOSITO_SOLICITANTE])
    dep_proveedor = db.relationship('Deposito', foreign_keys=[ID_DEPOSITO_PROVEEDOR])
    usuario = db.relationship('Usuario')


class Notificacion(db.Model):
    __tablename__ = 'notificaciones'
    ID_NOTIFICACION = db.Column(db.Integer, primary_key=True)
    
    # CORRECCIÓN 1: Cambiamos 'usuarios' por 'usuario' (singular)
    ID_USUARIO = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=False)
    
    MENSAJE = db.Column(db.String(255), nullable=False)
    LEIDA = db.Column(db.Boolean, default=False)
    
    # CORRECCIÓN 2: Ya funcionará porque arreglamos el import arriba
    FECHA_CREACION = db.Column(db.DateTime, default=datetime.datetime.now)
    
    # CORRECCIÓN 3: Aseguramos que busque la tabla 'orden_trabajo' (singular/snake_case)
    ID_ORDEN = db.Column(db.Integer, db.ForeignKey('orden_trabajo.ID_ORDEN'), nullable=True)

    def to_dict(self):
        return {
            "id": self.ID_NOTIFICACION,
            "mensaje": self.MENSAJE,
            "leida": self.LEIDA,
            "fecha": self.FECHA_CREACION.strftime('%Y-%m-%d %H:%M'),
            "id_orden": self.ID_ORDEN
        }
    
# ---------------------------------------------------------
# MODELOS PARA GESTIÓN DE TRASLADOS (VALES / REMISIONES)
# ---------------------------------------------------------
# ---------------------------------------------------------
# [NUEVO] MODELOS PARA GESTIÓN DE TRASLADOS (VALES / REMISIONES)
# ---------------------------------------------------------
# En backend/db.py

class EstadoVale(db.Model):
    __tablename__ = 'estado_vale'
    
    # Asegúrate de que los nombres de las variables (izquierda) sean exactos:
    ID_ESTADO_VALE = db.Column(db.Integer, primary_key=True)
    
    # AQUÍ ESTÁ EL ERROR: Antes seguro decía "NOMBRE = ...", cámbialo a:
    estado_vale = db.Column(db.String(50), nullable=False)

class Vale(db.Model):
    """
    Documento maestro del traslado.
    Vincula: Origen, Destino, Camión, Chofer y los responsables de cada etapa.
    """
    __tablename__ = 'vale'
    ID_VALE = db.Column(db.Integer, primary_key=True)
    
    # LOGÍSTICA
    ID_DEPOSITO_ORIGEN = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)
    ID_DEPOSITO_DESTINO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)
    
    # RESPONSABLES
    ID_USUARIO_CREADOR = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO')) # Inventario que armó el paquete
    ID_USUARIO_APROBADOR_SALIDA = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=True) # Admin Origen
    ID_USUARIO_RECEPTOR = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=True) # Admin Destino
    
    # TRANSPORTE
    ID_CHOFER = db.Column(db.Integer, db.ForeignKey('empleado.ID_EMPLEADO'), nullable=False)
    ID_VEHICULO = db.Column(db.Integer, db.ForeignKey('vehiculo.ID_VEHICULO'), nullable=False)
    
    # ESTADO Y TIEMPOS
    ID_ESTADO_VALE = db.Column(db.Integer, db.ForeignKey('estado_vale.ID_ESTADO_VALE'), default=1)
    FECHA_CREACION = db.Column(db.DateTime, default=datetime.datetime.now)
    FECHA_SALIDA = db.Column(db.DateTime, nullable=True) # Momento exacto que sale a ruta
    FECHA_LLEGADA = db.Column(db.DateTime, nullable=True) # Momento exacto que llega a destino
    
    OBSERVACIONES = db.Column(db.String(255))
    
    # Relaciones SQLAlchemy
    origen = db.relationship('Deposito', foreign_keys=[ID_DEPOSITO_ORIGEN])
    destino = db.relationship('Deposito', foreign_keys=[ID_DEPOSITO_DESTINO])
    chofer = db.relationship('Empleado', foreign_keys=[ID_CHOFER])
    vehiculo = db.relationship('Vehiculo')
    estado = db.relationship('EstadoVale')
    detalles = db.relationship('DetalleVale', backref='vale', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.ID_VALE,
            "origen": self.origen.NOMBRE,
            "destino": self.destino.NOMBRE,
            "chofer": f"{self.chofer.NOMBRE} {self.chofer.APELLIDO}",
            "vehiculo": f"{self.vehiculo.MARCA} - {self.vehiculo.MATRICULA}",
            "estado": self.estado.NOMBRE if self.estado else "Desconocido",
            "fecha_creacion": self.FECHA_CREACION.strftime('%Y-%m-%d %H:%M'),
            "fecha_salida": self.FECHA_SALIDA.strftime('%Y-%m-%d %H:%M') if self.FECHA_SALIDA else None,
            "latitud_origen": self.origen.LATITUD,  # Útil para el mapa
            "longitud_origen": self.origen.LONGITUD,
            "latitud_destino": self.destino.LATITUD,
            "longitud_destino": self.destino.LONGITUD
        }

class DetalleVale(db.Model):
    """
    Los items individuales dentro del camión.
    """
    __tablename__ = 'detalle_vale'
    ID_DETALLE_VALE = db.Column(db.Integer, primary_key=True)
    ID_VALE = db.Column(db.Integer, db.ForeignKey('vale.ID_VALE'), nullable=False)
    ID_MATERIAL = db.Column(db.Integer, db.ForeignKey('material.ID_MATERIAL'), nullable=False)
    CANTIDAD = db.Column(db.Float, nullable=False)
    
    material = db.relationship('Material')
# [backend/db.py] - Agregar al final

# ---------------------------------------------------------
# GASTOS Y FINANZAS
# ---------------------------------------------------------

class CategoriaGasto(db.Model):
    __tablename__ = 'categoria_gasto'
    ID_CATEGORIA = db.Column(db.Integer, primary_key=True)
    NOMBRE = db.Column(db.String(50), unique=True, nullable=False)
    COLOR = db.Column(db.String(20), default="#6b7280") # Para gráficas/UI

class Gasto(db.Model):
    __tablename__ = 'gasto'
    ID_GASTO = db.Column(db.Integer, primary_key=True)
    
    # Detalles
    TITULO = db.Column(db.String(100), nullable=False)
    DESCRIPCION = db.Column(db.String(255))
    MONTO = db.Column(db.Float, nullable=False)
    FECHA = db.Column(db.DateTime, default=datetime.datetime.now)
    
    # Relaciones
    ID_CATEGORIA = db.Column(db.Integer, db.ForeignKey('categoria_gasto.ID_CATEGORIA'), nullable=False)
    ID_USUARIO = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=False) # Quién registró
    ID_DEPOSITO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=True) # Si es gasto de sucursal
    
    # Opcional: Comprobante (URL o nombre archivo)
    COMPROBANTE = db.Column(db.String(255), nullable=True)
    
    # Objetos
    categoria = db.relationship('CategoriaGasto')
    usuario = db.relationship('Usuario')
    deposito = db.relationship('Deposito')

    def to_dict(self):
        return {
            "id": self.ID_GASTO,
            "titulo": self.TITULO,
            "descripcion": self.DESCRIPCION,
            "monto": self.MONTO,
            "fecha": self.FECHA.strftime('%Y-%m-%d %H:%M'),
            "fecha_iso": self.FECHA.strftime('%Y-%m-%d'),
            "categoria": self.categoria.NOMBRE if self.categoria else "General",
            "color": self.categoria.COLOR if self.categoria else "#ccc",
            "autor": f"{self.usuario.empleado.NOMBRE} {self.usuario.empleado.APELLIDO}" if self.usuario and self.usuario.empleado else self.usuario.CORREO,
            "deposito": self.deposito.NOMBRE if self.deposito else "General"
        }
