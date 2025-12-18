# sisdepo/backend/db.py
import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

# 1. Inicializar SQLAlchemy
db = SQLAlchemy()

# ---------------------------------------------------------
# MODELOS DE USUARIO Y PERSONAL
# ---------------------------------------------------------

class Rol(db.Model):
    __tablename__ = 'rol'
    ID_ROL = db.Column(db.Integer, primary_key=True)
    NOMBRE_ROL = db.Column(db.String(60))

class Deposito(db.Model):
    __tablename__ = 'deposito'
    ID_DEPOSITO = db.Column(db.Integer, primary_key=True)
    NOMBRE = db.Column(db.String(60))
    DIRECCION = db.Column(db.String(60))

    def to_dict(self):
        return {"ID_DEPOSITO": self.ID_DEPOSITO, "NOMBRE": self.NOMBRE}

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

class Usuario(db.Model):
    __tablename__ = 'usuario'
    # --- ESTOS SON LOS CAMPOS QUE FALTABAN ---
    ID_USUARIO = db.Column(db.Integer, primary_key=True)
    ID_ROL = db.Column(db.Integer, db.ForeignKey('rol.ID_ROL'))
    ID_EMPLEADO = db.Column(db.Integer, db.ForeignKey('empleado.ID_EMPLEADO'), unique=True)
    
    CORREO = db.Column(db.String(80), unique=True, nullable=False)
    CONTRASENA = db.Column(db.String(255), nullable=False)
    
    # Campos nuevos de perfil
    AVATAR = db.Column(db.String(255)) 
    BANNER_COLOR = db.Column(db.String(20), default='#5865F2')

    # Relaciones
    empleado = db.relationship('Empleado', back_populates='usuario')
    rol = db.relationship('Rol')

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
# MODELOS DE INVENTARIO
# ---------------------------------------------------------

class Material(db.Model):
    __tablename__ = 'material'
    ID_MATERIAL = db.Column(db.Integer, primary_key=True)
    CODIGO_UNICO = db.Column(db.Integer, unique=True) 
    NOMBRE = db.Column(db.String(60))
    
    def to_dict(self):
        return {"ID_MATERIAL": self.ID_MATERIAL, "CODIGO_UNICO": self.CODIGO_UNICO, "NOMBRE": self.NOMBRE}

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
    
    # Fechas (Importante: DateTime)
    FECHA_INICIO = db.Column(db.DateTime) 
    FECHA_CIERRE = db.Column(db.DateTime) 
    
        # --- NUEVO CAMPO: FECHA LÍMITE (Opcional) ---
    FECHA_LIMITE = db.Column(db.DateTime, nullable=True) 

    HERRAMIENTAS = db.Column(db.Text, nullable=True)
    TIEMPO_EMPLEADO = db.Column(db.String(50), nullable=True)
    ELIMINADA = db.Column(db.Boolean, default=False)

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
            
            # Formato corregido y único: DD/MM/YYYY HH:MM
            "fecha_inicio": self.FECHA_INICIO.strftime("%d/%m/%Y %H:%M") if self.FECHA_INICIO else None,
            "fecha_cierre": self.FECHA_CIERRE.strftime("%d/%m/%Y %H:%M") if self.FECHA_CIERRE else None,
            
            # AGREGAR ESTO AL DICCIONARIO:
            "fecha_limite": self.FECHA_LIMITE.strftime("%Y-%m-%dT%H:%M") if self.FECHA_LIMITE else "", # Formato ISO para el input datetime-local
            "fecha_limite_fmt": self.FECHA_LIMITE.strftime("%d/%m/%Y %H:%M") if self.FECHA_LIMITE else None, # Para mostrar bonito
            
            "herramientas": self.HERRAMIENTAS or "",
            "tiempo_empleado": self.TIEMPO_EMPLEADO or "",
            
            # Datos relacionados
            "deposito": self.deposito.NOMBRE if self.deposito else "-",
            "deposito_id": self.ID_DEPOSITO,
            "empleado_nombre": f"{self.empleado.NOMBRE} {self.empleado.APELLIDO}" if self.empleado else "Sin asignar",
            "empleado_id": self.ID_EMPLEADO,
            # Avatar
            "empleado_avatar": self.empleado.usuario.AVATAR if (self.empleado and self.empleado.usuario) else None
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
            # Formato con barras
            "fecha": self.FECHA_HORA.strftime("%d/%m/%Y %H:%M")
        }
