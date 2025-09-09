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

export default function RegisterPage() {
  const [full_name, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    console.log('📤 تلاش برای ثبت‌نام با:', { phone, full_name });

    try {
      const res = await api.post('/auth/register', {
        phone,
        password,
        full_name,
      });

      console.log('✅ ثبت‌نام موفق:', res.data);
      setSuccess('ثبت‌نام با موفقیت انجام شد. اکنون می‌توانید وارد شوید.');
    } catch (err: any) {
      console.error('❌ خطا در ثبت‌نام:', err);
      if (err.response) {
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
        <Typography variant="h5">ثبت‌نام کاربر جدید</Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}

        <TextField
          margin="normal"
          fullWidth
          label="نام کامل"
          value={full_name}
          onChange={(e) => setFullName(e.target.value)}
        />
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
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'ثبت‌نام'}
        </Button>
      </Box>
    </Container>
  );
}
