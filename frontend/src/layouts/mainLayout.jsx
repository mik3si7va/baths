import React from 'react';
import { Box } from '@mui/material';
import { Header } from '../components';

export default function MainLayout({ children }) {
    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#F5F0E8' }}>
            <Header />
            <Box sx={{ p: 4, maxWidth: 1100, mx: 'auto' }}>
                {children}
            </Box>
        </Box>
    );
}