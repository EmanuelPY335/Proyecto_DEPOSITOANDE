import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Pag1 from "./pages/Pag1";
import Pag2 from "./pages/Pag2";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/pag1" element={<Pag1 />} />
        <Route path="/pag2" element={<Pag2 />} />
      </Routes>
    </Router>
  );
}

export default App;
