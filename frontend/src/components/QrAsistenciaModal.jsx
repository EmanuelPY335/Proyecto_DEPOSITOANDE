import React, { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, AlertTriangle, CheckCircle, Loader2, MapPin, ScanLine } from "lucide-react";
import { apiFetch } from "../utils/api";
import "../styles/QrAsistenciaModal.css"; // Asegúrate de importar el CSS

const QRAsistenciaModal = ({ onClose, user }) => {
    const [status, setStatus] = useState("scanning"); 
    const [msg, setMsg] = useState("Escanea el código QR de la entrada");
    
    const scannerRef = useRef(null);
    const isMounted = useRef(true);
    const isProcessing = useRef(false);
    const isScannerActive = useRef(false);

    const stopScannerSafe = async () => {
        if (scannerRef.current && isScannerActive.current) {
            try {
                isScannerActive.current = false; 
                await scannerRef.current.stop();
                scannerRef.current.clear();
            } catch (err) {
                console.warn("Aviso al detener scanner:", err);
            }
        }
    };

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            stopScannerSafe();
        };
    }, []);

    const verificarUbicacionYMarcar = useCallback(async (qrContent) => {
        if (!isMounted.current) return;

        if (!user || !user.ID_USUARIO) {
            setStatus("error");
            setMsg("Error: Usuario no identificado.");
            return;
        }

        if (!navigator.geolocation) {
            setStatus("error");
            setMsg("Tu dispositivo no soporta GPS.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                if (!isMounted.current) return;
                try {
             
                    const payload = {
                        usuario_id: user.ID_USUARIO,
                        qr_content: qrContent,
                        latitud: position.coords.latitude,
                        longitud: position.coords.longitude
                    };

                    const response = await apiFetch("api/asistencia/qr-marcar", { 
                        method: "POST",
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    
                    if (response && response.success) {
                        setStatus("success");
                        setMsg(response.msg);
                        await stopScannerSafe();
                        setTimeout(() => { 
                            if (isMounted.current) onClose(); 
                        }, 3000);
                    } else {
                        throw new Error(response?.msg || "Error desconocido");
                    }
                } catch (error) {
                    console.error("❌ Error API:", error);
                    setStatus("error");
                    setMsg(error.message || "Error de conexión.");
                }
            },
            (err) => {
                console.warn("📍 GPS Error:", err);
                if (isMounted.current) {
                    setStatus("error");
                    setMsg("Activa tu GPS y permite el acceso.");
                }
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, [user, onClose]);

    const onScanSuccess = (decodedText) => {
        if (isProcessing.current) return;
        
        console.log(`QR Detectado: ${decodedText}`);
        isProcessing.current = true; 

        if (!decodedText.startsWith("SISDEPO-")) {
            setStatus("error");
            setMsg("QR inválido (No es de SISDEPO).");
            setTimeout(() => {
                if (isMounted.current) {
                    setStatus("scanning");
                    setMsg("Escanea el código QR de la entrada");
                    isProcessing.current = false; 
                }
            }, 2000);
            return;
        }

        setStatus("verifying");
        setMsg("Validando ubicación...");
        verificarUbicacionYMarcar(decodedText);
    };

    const reiniciarScanner = () => {
        isProcessing.current = false;
        setStatus("scanning");
        setMsg("Escanea el código QR de la entrada");
    };

    useEffect(() => {
        if (status === "scanning" && !isScannerActive.current) {
            if (!scannerRef.current) {
                 scannerRef.current = new Html5Qrcode("reader");
            }

            const config = { fps: 10, qrbox: { width: 250, height: 250 } };
            
            scannerRef.current.start(
                { facingMode: "environment" }, 
                config, 
                onScanSuccess,
                () => {}
            ).then(() => {
                isScannerActive.current = true;
            }).catch((err) => {
                console.error("Error start scanner:", err);
                setMsg("Error cámara. Revisa permisos.");
                setStatus("error");
            });
        }
    }, [status]); 

    if (!user || !user.ID_USUARIO) return null;

    return (
        <div className="modal-backdrop">
            <div className="qr-modal-card">
                
                {/* --- HEADER --- */}
                <div className="qr-header">
                    <h3>
                        <MapPin size={22} color="#005bea"/> 
                        Fichar Asistencia
                    </h3>
                    <button className="close-btn-qr" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* --- CAMERA BOX --- */}
                <div className="qr-scanner-container">
                    
                    {/* Div donde la librería monta el video */}
                    <div id="reader" style={{ display: status === 'scanning' ? 'block' : 'none' }}></div>
                    
                    {/* Línea de escaneo animada (solo si está escaneando) */}
                    {status === 'scanning' && <div className="scan-line"></div>}

                    {/* --- ESTADOS SUPERPUESTOS --- */}
                    {status === "verifying" && (
                        <div className="overlay-status fade-in">
                            <Loader2 size={48} className="animate-spin" style={{marginBottom: 12}}/>
                            <span>Verificando ubicación...</span>
                        </div>
                    )}
                    
                    {status === "success" && (
                        <div className="overlay-status fade-in">
                            <CheckCircle size={64} color="#10b981" style={{marginBottom: 12}}/>
                            <span>¡Registrado!</span>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="overlay-status fade-in">
                            <AlertTriangle size={56} color="#ef4444" style={{marginBottom: 12}}/>
                        </div>
                    )}
                </div>

                {/* --- FOOTER / MESSAGE --- */}
                <div className="qr-footer">
                    <p className={`qr-msg ${status === 'error' ? 'error' : status === 'success' ? 'success' : ''}`}>
                        {msg}
                    </p>
                    
                    {status === 'error' && (
                        <button className="btn-retry" onClick={reiniciarScanner}>
                            Intentar de nuevo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QRAsistenciaModal;