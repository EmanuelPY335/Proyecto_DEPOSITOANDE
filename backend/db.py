# sisdepo/backend/db.py
import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.dialects.postgresql import JSONB
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
class Departamento(db.Model):
    __tablename__ = 'departamentos' 
    id_departamentos = db.Column(db.Integer, primary_key=True)
    departamento = db.Column(db.String(60), nullable=False)
    
    # Esta línea permite hacer departamento.depositos
    depositos = db.relationship('Deposito', back_populates='departamento_rel', lazy=True)

class Deposito(db.Model):
    __tablename__ = 'deposito'
    ID_DEPOSITO = db.Column(db.Integer, primary_key=True)
    NOMBRE = db.Column(db.String(60))
    DIRECCION = db.Column(db.String(100)) # Aumentamos un poco el tamaño por si acaso
    
    # --- NUEVOS CAMPOS DE UBICACIÓN ---
    LATITUD = db.Column(db.Float, nullable=True)
    LONGITUD = db.Column(db.Float, nullable=True)
    RADIO_MTS = db.Column(db.Integer, default=80)
    id_departamentos = db.Column(db.Integer, db.ForeignKey('departamentos.id_departamentos'))
    # ----------------------------------
    departamento_rel = db.relationship('Departamento', back_populates='depositos')
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
    deposito = db.relationship('Deposito')
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
            "BANNER_COLOR": self.BANNER_COLOR,
            "ID_DEPOSITO": self.empleado.ID_DEPOSITO
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
    FACTOR_PUNTOS = db.Column(db.Integer, default=1)
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
    CODIGO = db.Column(db.String(50))
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

    # ✅ NUEVO: ubicación física dentro del depósito
    ID_SECTOR_ACTUAL = db.Column(db.Integer, db.ForeignKey('deposito_sector.ID_SECTOR'), nullable=True)
    UBICACION_DETALLE = db.Column(db.String(80), nullable=True)  # Ej: Estante 3

    # Relaciones
    lote = db.relationship('Lote', backref='inventarios')
    estado = db.relationship('EstadoInventario')
    sector = db.relationship('DepositoSector')

    def to_dict(self):
        mat = self.lote.material if (self.lote and self.lote.material) else None
        return {
            "id_inventario": self.ID_INVENTARIO,
            "material": mat.NOMBRE if mat else None,
            "codigo": mat.CODIGO_UNICO if mat else None,
            "lote_id": self.ID_LOTE,
            "fecha_ingreso": self.lote.FECHA_INGRESO.strftime('%Y-%m-%d') if (self.lote and self.lote.FECHA_INGRESO) else None,
            "deposito": self.deposito.NOMBRE if self.deposito else None,
            "deposito_id": self.ID_DEPOSITO,
            "cantidad": self.CANTIDAD_ACTUAL,
            "estado": self.estado.ESTADO_INVENTARIO if self.estado else "Desconocido",

            # ✅ NUEVO (para tu JSON esperado)
            "sector_codigo": self.sector.CODIGO if self.sector else None,
            "sector_nombre": self.sector.NOMBRE if self.sector else None,
            "ubicacion_detalle": self.UBICACION_DETALLE
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
    
    ELIMINADO = db.Column(db.Boolean, default=False)
    FECHA_ELIMINADO = db.Column(db.DateTime, nullable=True)
    ID_USUARIO_ELIMINO = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=True)
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
    # --- AGREGA ESTAS DOS LÍNEAS ---
    LATITUD = db.Column(db.Float, nullable=True)
    LONGITUD = db.Column(db.Float, nullable=True)
    # --- [NUEVO] RELACIÓN CON ESTADO DE VEHÍCULO ---
    ID_ESTADO = db.Column(db.Integer, db.ForeignKey('estado_vehiculo.ID_ESTADO'), nullable=False, default=1)
    CAPACIDAD_PUNTOS = db.Column(db.Integer, nullable=True)
    # Opcional: Campo de texto antiguo por compatibilidad (si quieres borrarlo, hazlo después)
    chofer = db.relationship('Empleado', backref='vehiculos')
    # -----------------------------------------------
    posiciones = db.relationship('PosicionGps', backref='vehiculo', lazy=True)
class EstadoVehiculo(db.Model):
    __tablename__ = 'estado_vehiculo'
    ID_ESTADO = db.Column(db.Integer, primary_key=True)
    NOMBRE = db.Column(db.String(50), nullable=False)
    COLOR_HEX = db.Column(db.String(10)) # Guardamos el color aquí (ej: #10b981)
    DESCRIPCION = db.Column(db.String(100))
    
    # Relación inversa
    vehiculos = db.relationship('Vehiculo', backref='estado_rel', lazy=True)
    
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

# En backend/db.py

class Asistencia(db.Model):
    __tablename__ = 'asistencia'
    ID_ASISTENCIA = db.Column(db.Integer, primary_key=True)
    ID_EMPLEADO = db.Column(db.Integer, db.ForeignKey('empleado.ID_EMPLEADO'), nullable=False)
    
    # --- CAMBIOS PARA TU ESTRUCTURA REAL ---
    # Usamos DateTime para guardar fecha y hora juntas
    FECHA_HORA_ENTRADA = db.Column(db.DateTime, default=datetime.datetime.now)
    FECHA_HORA_SALIDA = db.Column(db.DateTime, nullable=True)
    # ---------------------------------------


    LATITUD_MARCADO = db.Column(db.Numeric(10, 8))
    LONGITUD_MARCADO = db.Column(db.Numeric(11, 8))
    METODO = db.Column(db.String(20)) # 'QR'
    
    empleado = db.relationship('Empleado', backref='asistencias')

class EstadoOrden(db.Model):
    __tablename__ = 'estado_orden'
    ID_ESTADO_ORDEN = db.Column(db.Integer, primary_key=True)
    ESTADO_ORDEN = db.Column(db.String(40))

class OrdenTrabajo(db.Model):
    __tablename__ = 'orden_trabajo'
    ID_ORDEN = db.Column(db.Integer, primary_key=True)

    ID_ESTADO_ORDEN = db.Column(db.Integer, db.ForeignKey('estado_orden.ID_ESTADO_ORDEN'), nullable=False)
    ID_DEPOSITO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)

    # ✅ IMPORTANTE: vos creás órdenes sin empleado asignado
    ID_EMPLEADO = db.Column(db.Integer, db.ForeignKey('empleado.ID_EMPLEADO'), nullable=True)

    TITULO = db.Column(db.String(100), nullable=False)
    DESCRIPCION = db.Column(db.Text)
    PRIORIDAD = db.Column(db.String(20), default="Media")

    FECHA_INICIO = db.Column(db.DateTime)
    FECHA_CIERRE = db.Column(db.DateTime)
    FECHA_LIMITE = db.Column(db.DateTime, nullable=True)

    HERRAMIENTAS = db.Column(db.Text, nullable=True)
    TIEMPO_EMPLEADO = db.Column(db.String(50), nullable=True)
    ELIMINADA = db.Column(db.Boolean, default=False)

    # Movimiento interno
    TIPO_ORDEN = db.Column(db.String(20), default="General")
    ID_LOTE_OBJETIVO = db.Column(db.Integer, db.ForeignKey('lote.ID_LOTE'), nullable=True)
    CANTIDAD_MOVIMIENTO = db.Column(db.Float, default=0)
    NUEVA_UBICACION = db.Column(db.String(100), nullable=True)
    ID_SECTOR_DESTINO = db.Column(db.Integer, db.ForeignKey('deposito_sector.ID_SECTOR'), nullable=True)
    # ✅ NUEVO: maquinaria
    ID_MAQUINARIA = db.Column(db.Integer, db.ForeignKey('maquinaria.ID_MAQUINARIA'), nullable=True)

    # (Opcional recomendado) si querés destino estructurado
    # ID_SECTOR_DESTINO = db.Column(db.Integer, db.ForeignKey('deposito_sector.ID_SECTOR'), nullable=True)
    # UBICACION_DESTINO_DETALLE = db.Column(db.String(80), nullable=True)

    estado = db.relationship('EstadoOrden')
    deposito = db.relationship('Deposito')
    empleado = db.relationship('Empleado', backref='ordenes_asignadas')
    avances = db.relationship('AvanceOrden', backref='orden', cascade="all, delete-orphan")

    maquinaria = db.relationship('Maquinaria')

    def to_dict(self):
        emp_nombre = "Sin asignar"
        emp_id = None
        emp_avatar = None
        if self.empleado:
            emp_nombre = f"{self.empleado.NOMBRE} {self.empleado.APELLIDO}"
            emp_id = self.ID_EMPLEADO
            emp_avatar = self.empleado.usuario.AVATAR if self.empleado.usuario else None

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
            "empleado_nombre": emp_nombre,
            "empleado_id": emp_id,
            "empleado_avatar": emp_avatar,

            "tipo_orden": self.TIPO_ORDEN,
            "cantidad_mov": self.CANTIDAD_MOVIMIENTO,
            "nueva_ubicacion": self.NUEVA_UBICACION,

            # ✅ nuevo dato
            "maquinaria_id": self.ID_MAQUINARIA,
            "maquinaria_nombre": self.maquinaria.NOMBRE_MAQUI if self.maquinaria else None,
            "maquinaria_tipo": self.maquinaria.TIPO_MAQUI if self.maquinaria else None,
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

class SolicitudStock(db.Model):
    __tablename__ = 'solicitud_stock'
    ID_SOLICITUD = db.Column(db.Integer, primary_key=True)
    
    # Cabecera
    ID_DEPOSITO_SOLICITANTE = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)
    ID_USUARIO_SOLICITANTE = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=False)
    ID_DEPOSITO_PROVEEDOR = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)
    
    ID_ESTADO = db.Column(db.Integer, db.ForeignKey('estado_solicitud.ID_ESTADO'), default=1)
    FECHA_SOLICITUD = db.Column(db.DateTime, default=datetime.datetime.now)
    FECHA_CIERRE = db.Column(db.DateTime, nullable=True)
    OBSERVACION_GENERAL = db.Column(db.String(255))

    # Relaciones
    dep_solicitante = db.relationship('Deposito', foreign_keys=[ID_DEPOSITO_SOLICITANTE])
    dep_proveedor = db.relationship('Deposito', foreign_keys=[ID_DEPOSITO_PROVEEDOR])
    usuario = db.relationship('Usuario')
    estado = db.relationship('EstadoSolicitud')
    
    # RELACIÓN CLAVE: Una solicitud tiene muchos detalles
    detalles = db.relationship('DetalleSolicitud', backref='solicitud', cascade="all, delete-orphan")

class DetalleSolicitud(db.Model):
    __tablename__ = 'detalle_solicitud'
    ID_DETALLE = db.Column(db.Integer, primary_key=True)
    
    ID_SOLICITUD = db.Column(db.Integer, db.ForeignKey('solicitud_stock.ID_SOLICITUD'), nullable=False)
    ID_MATERIAL = db.Column(db.Integer, db.ForeignKey('material.ID_MATERIAL'), nullable=False)
    
    CANTIDAD = db.Column(db.Float, nullable=False)
    OBSERVACION_ITEM = db.Column(db.String(100), nullable=True)

    # Relaciones
    material = db.relationship('Material')

# --- NOTIFICACIONES (ACTUALIZADO) ---

class Notificacion(db.Model):
    __tablename__ = 'notificaciones'
    ID_NOTIFICACION = db.Column(db.Integer, primary_key=True)

    ID_USUARIO = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=False)

    MENSAJE = db.Column(db.String(255), nullable=False)

    # NUEVOS CAMPOS PARA SOPORTAR BUZÓN/MENÚ
    TIPO = db.Column(db.String(60), default="info")            # ej: pedido, orden, ruta, alerta, check, vale, info
    SENDER = db.Column(db.String(80), default="Sistema")       # ej: Sistema / Admin / Depósito X
    DEPOSITO = db.Column(db.String(80), nullable=True)         # texto simple para filtros (nombre)
    LINK_NOTI = db.Column(db.String(255), nullable=True)       # link del frontend (/ordenes/10 etc)

    LEIDA = db.Column(db.Boolean, default=False)
    STARRED = db.Column(db.Boolean, default=False)
    FECHA_CREACION = db.Column(db.DateTime, default=datetime.datetime.now)

    ID_ORDEN = db.Column(db.Integer, db.ForeignKey('orden_trabajo.ID_ORDEN'), nullable=True)

    META = db.Column(JSONB, nullable=True)

    def to_dict(self):
        dt = self.FECHA_CREACION or datetime.datetime.now()
        return {
            "id": self.ID_NOTIFICACION,
            "usuario_id": self.ID_USUARIO,

            "mensaje": self.MENSAJE,
            "tipo": (self.TIPO or "info"),
            "sender": (self.SENDER or "Sistema"),
            "deposito": self.DEPOSITO or "",
            "link": self.LINK_NOTI,

            "leida": bool(self.LEIDA),
            "starred": bool(self.STARRED),

            "fecha": dt.strftime('%Y-%m-%d %H:%M:%S'),
            "fecha_iso": dt.strftime('%Y-%m-%dT%H:%M:%S'),
            "fecha_display": dt.strftime('%d/%m/%Y %H:%M'),

            "id_orden": self.ID_ORDEN,
            "origen": "db",
            "meta": self.META or {},

        }


# --- VALES (ACTUALIZADO) ---

class EstadoVale(db.Model):
    __tablename__ = 'estado_vale'
    ID_ESTADO_VALE = db.Column(db.Integer, primary_key=True)
    estado_vale = db.Column(db.String(50), nullable=False)


class Vale(db.Model):
    __tablename__ = 'vale'
    ID_VALE = db.Column(db.Integer, primary_key=True)

    ID_DEPOSITO_ORIGEN = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)
    ID_DEPOSITO_DESTINO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)

    ID_USUARIO_CREADOR = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'))
    ID_USUARIO_APROBADOR_SALIDA = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=True)
    ID_USUARIO_RECEPTOR = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=True)

    ID_CHOFER = db.Column(db.Integer, db.ForeignKey('empleado.ID_EMPLEADO'), nullable=False)
    ID_VEHICULO = db.Column(db.Integer, db.ForeignKey('vehiculo.ID_VEHICULO'), nullable=False)

    ID_ESTADO_VALE = db.Column(db.Integer, db.ForeignKey('estado_vale.ID_ESTADO_VALE'), default=1)
    FECHA_CREACION = db.Column(db.DateTime, default=datetime.datetime.now)
    FECHA_SALIDA = db.Column(db.DateTime, nullable=True)
    FECHA_LLEGADA = db.Column(db.DateTime, nullable=True)
    GRUPO_RUTA = db.Column(db.String(50), nullable=True)
    OBSERVACIONES = db.Column(db.String(255))

    origen = db.relationship('Deposito', foreign_keys=[ID_DEPOSITO_ORIGEN])
    destino = db.relationship('Deposito', foreign_keys=[ID_DEPOSITO_DESTINO])
    chofer = db.relationship('Empleado', foreign_keys=[ID_CHOFER])
    vehiculo = db.relationship('Vehiculo')
    estado = db.relationship('EstadoVale')
    detalles = db.relationship('DetalleVale', backref='vale', cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.ID_VALE,
            "origen": self.origen.NOMBRE if self.origen else "",
            "destino": self.destino.NOMBRE if self.destino else "",
            "chofer": f"{self.chofer.NOMBRE} {self.chofer.APELLIDO}" if self.chofer else "",
            "vehiculo": f"{self.vehiculo.MARCA} - {self.vehiculo.MATRICULA}" if self.vehiculo else "",
            # FIX ACÁ:
            "estado": self.estado.estado_vale if self.estado else "Desconocido",
            "fecha_creacion": self.FECHA_CREACION.strftime('%Y-%m-%d %H:%M') if self.FECHA_CREACION else "",
            "fecha_salida": self.FECHA_SALIDA.strftime('%Y-%m-%d %H:%M') if self.FECHA_SALIDA else None,
            "latitud_origen": self.origen.LATITUD if self.origen else None,
            "longitud_origen": self.origen.LONGITUD if self.origen else None,
            "latitud_destino": self.destino.LATITUD if self.destino else None,
            "longitud_destino": self.destino.LONGITUD if self.destino else None
        }


# backend/db.py (Solo la clase DetalleVale)

# En backend/db.py

class DetalleVale(db.Model):
    __tablename__ = 'detalle_vale'
    ID_DETALLE_VALE = db.Column(db.Integer, primary_key=True)
    ID_VALE = db.Column(db.Integer, db.ForeignKey('vale.ID_VALE'), nullable=False)
    ID_LOTE = db.Column(db.Integer, db.ForeignKey('lote.ID_LOTE'), nullable=False)
    ID_MATERIAL = db.Column(db.Integer, db.ForeignKey('material.ID_MATERIAL'), nullable=False)
    
    # --- CAMBIO AQUÍ: Usamos el nombre real de tu tabla ---
    CANTIDAD_SOLICITADA = db.Column(db.Float, nullable=False) 
    # -----------------------------------------------------

    material = db.relationship('Material')
    lote = db.relationship('Lote')
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

    TITULO = db.Column(db.String(100), nullable=False)
    DESCRIPCION = db.Column(db.String(255))
    MONTO = db.Column(db.Float, nullable=False)
    FECHA = db.Column(db.DateTime, default=datetime.datetime.now)

    ID_CATEGORIA = db.Column(db.Integer, db.ForeignKey('categoria_gasto.ID_CATEGORIA'), nullable=False)
    ID_USUARIO = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=False)
    ID_DEPOSITO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=True)

    ID_VEHICULO = db.Column(db.Integer, db.ForeignKey('vehiculo.ID_VEHICULO'), nullable=True)

    COMPROBANTE = db.Column(db.String(255), nullable=True)

    categoria = db.relationship('CategoriaGasto')
    usuario = db.relationship('Usuario')
    deposito = db.relationship('Deposito')
    vehiculo = db.relationship('Vehiculo')

    def to_dict(self):
        return {
            "id": self.ID_GASTO,
            "titulo": self.TITULO,
            "descripcion": self.DESCRIPCION,
            "monto": self.MONTO,
            "fecha": self.FECHA.strftime('%Y-%m-%d %H:%M') if self.FECHA else "",
            "fecha_iso": self.FECHA.strftime('%Y-%m-%d') if self.FECHA else "",
            "categoria": self.categoria.NOMBRE if self.categoria else "General",
            "color": self.categoria.COLOR if self.categoria else "#ccc",
            "autor": (
                f"{self.usuario.empleado.NOMBRE} {self.usuario.empleado.APELLIDO}"
                if (self.usuario and self.usuario.empleado) else (self.usuario.CORREO if self.usuario else "")
            ),
            "deposito": self.deposito.NOMBRE if self.deposito else "General",
            "vehiculo": (
                f"{self.vehiculo.MARCA} ({self.vehiculo.MATRICULA})"
                if self.vehiculo else None
            ),
            "vehiculo_id": self.ID_VEHICULO
        }

    
class DepositoSector(db.Model):
    __tablename__ = 'deposito_sector'
    ID_SECTOR = db.Column(db.Integer, primary_key=True)
    ID_DEPOSITO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)

    CODIGO = db.Column(db.String(10), nullable=False)   # Ej: A, B, C
    NOMBRE = db.Column(db.String(60), nullable=False)   # Ej: Pasillo B
    ACTIVO = db.Column(db.Boolean, default=True)

    __table_args__ = (
        db.UniqueConstraint('ID_DEPOSITO', 'CODIGO', name='uq_sector_dep_codigo'),
    )

    deposito = db.relationship('Deposito', backref=db.backref('sectores', lazy=True))

class Maquinaria(db.Model):
    __tablename__ = 'maquinaria'
    ID_MAQUINARIA = db.Column(db.Integer, primary_key=True)
    ID_DEPOSITO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=False)

    NOMBRE_MAQUI = db.Column(db.String(80), nullable=False)
    TIPO_MAQUI = db.Column(db.String(60), nullable=True)

    ACTIVA_MAQUI = db.Column(db.Boolean, default=True)

    # ✅ ALIAS para que tu código viejo (ACTIVA) NO rompa
    ACTIVA = db.synonym('ACTIVA_MAQUI')
    NOMBRE = db.synonym('NOMBRE_MAQUI')
    TIPO = db.synonym('TIPO_MAQUI')
    
    OBSERVACIONES_MAQUI = db.Column(db.String(254), nullable=True)

    deposito = db.relationship('Deposito', backref=db.backref('maquinarias', lazy=True))

    def to_dict(self):
        return {
            "id": self.ID_MAQUINARIA,
            "deposito_id": self.ID_DEPOSITO,
            "nombre": self.NOMBRE_MAQUI,
            "tipo": self.TIPO_MAQUI,
            "activa": bool(self.ACTIVA_MAQUI),
            "observaciones": self.OBSERVACIONES_MAQUI or ""
        }
# [backend/db.py] - Agregar al final

# [Al final de db.py]

class Auditoria(db.Model):
    __tablename__ = 'auditoria'
    ID_AUDITORIA = db.Column(db.Integer, primary_key=True)
    
    ID_USUARIO = db.Column(db.Integer, db.ForeignKey('usuario.ID_USUARIO'), nullable=True)
    NOMBRE_USUARIO = db.Column(db.String(100)) 
    ROL_MOMENTO = db.Column(db.String(50))     
    
    ID_DEPOSITO = db.Column(db.Integer, db.ForeignKey('deposito.ID_DEPOSITO'), nullable=True)
    NOMBRE_DEPOSITO = db.Column(db.String(60)) 
    
    ACCION_REALIZADA = db.Column(db.String(100))
    DETALLE = db.Column(db.Text)
    
    TABLA_AFECTADA = db.Column(db.String(60))
    ID_REGISTRO_AFECTADO = db.Column(db.Integer)
    
    IP_ADDRESS = db.Column(db.String(45), nullable=True)
    FECHA_HORA = db.Column(db.DateTime, default=datetime.datetime.now)

    usuario = db.relationship('Usuario')
    deposito = db.relationship('Deposito')

 # En backend/db.py, busca la clase Auditoria y actualiza el to_dict:

    def to_dict(self):
        return {
            "id": self.ID_AUDITORIA,
            "fecha": self.FECHA_HORA.strftime('%d/%m/%Y %H:%M') if self.FECHA_HORA else "-",
            "usuario": self.NOMBRE_USUARIO,
            "rol": self.ROL_MOMENTO,
            "deposito": self.NOMBRE_DEPOSITO,
            "accion": self.ACCION_REALIZADA,
            "detalle": self.DETALLE,
            
            # ✅ DATOS TÉCNICOS AGREGADOS
            "tabla": self.TABLA_AFECTADA,
            "id_registro": self.ID_REGISTRO_AFECTADO,
            "ip": self.IP_ADDRESS
        }