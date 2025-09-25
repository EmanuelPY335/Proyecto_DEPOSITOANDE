import React from "react";
import { Link } from "react-router-dom";
import { Home, FileText, Layers } from "lucide-react"; // íconos

const Sidebar = () => {
  return (
    <div className="sidebar">
      <h2 className="logo">Mi App</h2>
      <nav>
        <ul>
          <li>
            <Link to="/home">
              <Home size={18} style={{ marginRight: "8px" }} /> Inicio
            </Link>
          </li>
          <li>
            <Link to="/pag1">
              <FileText size={18} style={{ marginRight: "8px" }} /> Página 1
            </Link>
          </li>
          <li>
            <Link to="/pag2">
              <Layers size={18} style={{ marginRight: "8px" }} /> Página 2
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;

