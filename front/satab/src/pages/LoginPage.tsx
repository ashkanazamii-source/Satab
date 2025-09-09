'use client';
import { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Alert,
  CircularProgress,
} from '@mui/material';
import api from '../services/api'; // مسیر صحیح فایل api.ts

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    console.log('📤 تلاش برای ورود با:', { phone, password });

    try {
      const res = await api.post('/auth/login', { phone, password });
      console.log('✅ ورود موفق:', res.data);

      const { access_token, user } = res.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user));

      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('❌ خطا در ورود:', err);
      if (err.response) {
        console.error('📥 پاسخ سرور:', err.response.data);
        setError(err.response.data.message || 'خطای ناشناخته از سرور');
      } else {
        setError('اتصال به سرور برقرار نشد.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs">
      <Box mt={8} display="flex" flexDirection="column" alignItems="center">
        <Typography variant="h5">ورود به حساب کاربری</Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <TextField
          margin="normal"
          fullWidth
          label="شماره موبایل"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <TextField
          margin="normal"
          fullWidth
          label="رمز عبور"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 3 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'ورود'}
        </Button>
      </Box>
    </Container>
  );
}
