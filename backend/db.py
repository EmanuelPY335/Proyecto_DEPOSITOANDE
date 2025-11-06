# sisdepo/backend/db.py
import datetime # Importación corregida
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

# 1. Inicializar SQLAlchemy.
db = SQLAlchemy()

# 2. Definir TODOS los Modelos aquí

class Empleado(db.Model):
    """ Modelo para la tabla EMPLEADO """
    __tablename__ = 'EMPLEADO'
    
    # --- ¡ESTA ES LA LÍNEA QUE FALTABA Y CAUSABA EL ERROR! ---
    ID_EMPLEADO = db.Column(db.Integer, primary_key=True)
    
    ID_DEPOSITO = db.Column(db.Integer, db.ForeignKey('DEPOSITO.ID_DEPOSITO'))
    NUMERO_DOCUMENTO = db.Column(db.Integer, unique=True) 
    NOMBRE = db.Column(db.String(60))
    APELLIDO = db.Column(db.String(60))
    ESTADO_ACTIVO = db.Column(db.Boolean, default=True)
    TELEFONO = db.Column(db.BigInteger, unique=True)
    FECHA_NACIMIENTO = db.Column(db.Date, nullable=True) 
    usuario = db.relationship('Usuario', back_populates='empleado', uselist=False)
    deposito = db.relationship('Deposito')

class Usuario(db.Model):
    """ Modelo para la tabla USUARIO """
    __tablename__ = 'USUARIO'
    ID_USUARIO = db.Column(db.Integer, primary_key=True)
    ID_ROL = db.Column(db.Integer, db.ForeignKey('ROL.ID_ROL'))
    ID_EMPLEADO = db.Column(db.Integer, db.ForeignKey('EMPLEADO.ID_EMPLEADO'), unique=True)
    CORREO = db.Column(db.String(80), unique=True, nullable=False)
    CONTRASENA = db.Column(db.String(255), nullable=False) 
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
            "CORREO": self.CORREO
        }

class Deposito(db.Model):
    """ Modelo para la tabla DEPOSITO """
    __tablename__ = 'DEPOSITO'
    ID_DEPOSITO = db.Column(db.Integer, primary_key=True)
    NOMBRE = db.Column(db.String(60))
    DIRECCION = db.Column(db.String(60))
    def to_dict(self):
        return {"ID_DEPOSITO": self.ID_DEPOSITO, "NOMBRE": self.NOMBRE}

class Material(db.Model):
    """ Modelo para la tabla MATERIAL """
    __tablename__ = 'MATERIAL'
    ID_MATERIAL = db.Column(db.Integer, primary_key=True)
    CODIGO_UNICO = db.Column(db.Integer, unique=True) 
    NOMBRE = db.Column(db.String(60))
    def to_dict(self):
        return {"ID_MATERIAL": self.ID_MATERIAL, "CODIGO_UNICO": self.CODIGO_UNICO, "NOMBRE": self.NOMBRE}

class PasswordResetToken(db.Model):
    """ Modelo para la tabla password_reset_tokens """
    __tablename__ = 'password_reset_tokens'

    # 🔹 Elimina 'ID' porque no existe en la base
    EMAIL = db.Column('EMAIL', db.String(255), nullable=False)
    TOKEN = db.Column('TOKEN', db.String(64), primary_key=True, index=True, unique=True, nullable=False)
    EXPIRES_AT = db.Column('EXPIRES_AT', db.DateTime, nullable=False)



class Rol(db.Model):
    """ Modelo para la tabla ROL """
    __tablename__ = 'ROL'
    ID_ROL = db.Column(db.Integer, primary_key=True)
    NOMBRE_ROL = db.Column(db.String(60))

class Vehiculo(db.Model):
    """ Modelo para la tabla VEHICULO """
    __tablename__ = "VEHICULO"
    ID_VEHICULO = db.Column(db.Integer, primary_key=True)
    ID_EMPLEADO = db.Column(db.Integer, db.ForeignKey("EMPLEADO.ID_EMPLEADO"), nullable=False)
    MATRICULA = db.Column(db.String(10), nullable=False, unique=True)
    MARCA = db.Column(db.String(40))
    MODELO = db.Column(db.String(30))
    posiciones = db.relationship('PosicionGps', backref='vehiculo', lazy=True)

class PosicionGps(db.Model):
    """ Modelo para la tabla REGISTRO_GPS """
    __tablename__ = "REGISTRO_GPS"
    ID_REGISTRO_GPS = db.Column(db.Integer, primary_key=True)
    ID_VEHICULO = db.Column(db.Integer, db.ForeignKey("VEHICULO.ID_VEHICULO"), nullable=False)
    LATITUD = db.Column(db.DECIMAL(10, 7))
    LONGITUD = db.Column(db.DECIMAL(10, 7))
    # Corrección de 'datetime'
    FECHA_HORA = db.Column(db.DateTime, default=datetime.datetime.utcnow)