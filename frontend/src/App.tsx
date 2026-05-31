import { Route, Routes } from 'react-router-dom'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<p>Home (placeholder)</p>} />
      <Route path="/login" element={<p>Login (placeholder)</p>} />
      <Route path="/register" element={<p>Register (placeholder)</p>} />
    </Routes>
  )
}
