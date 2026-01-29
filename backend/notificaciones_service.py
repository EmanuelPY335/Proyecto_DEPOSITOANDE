from db import db, Notificacion

from db import db, Notificacion

def crear_notificacion(
    user_id: int,
    mensaje: str,
    evento: str = "info.general",
    link: str | None = None,
    deposito: str | None = None,
    sender: str = "Sistema",
    id_orden: int | None = None,
    meta: dict | None = None
):
    n = Notificacion(
        ID_USUARIO=user_id,
        MENSAJE=mensaje,
        TIPO=evento,
        LINK_NOTI=link,
        DEPOSITO=deposito,
        SENDER=sender,
        ID_ORDEN=id_orden,
        META=meta
    )
    db.session.add(n)
    db.session.commit()
    return n

