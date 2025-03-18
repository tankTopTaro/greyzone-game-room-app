import { Navigate, Route, Routes } from "react-router-dom"
import Monitor from "./pages/Monitor"
import Room from "./pages/Room"

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Monitor />} />
      <Route path="/monitor" element={<Navigate to='/' replace />} />
      <Route path="/room" element={<Room />} />
    </Routes>
  )
}

export default App
