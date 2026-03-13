import React from 'react';
import { Box } from '@mui/material';
import { HeaderCompact } from '../components';

export default function CompactLayout({ children }) {
    return (
        <Box sx={{ minHeight: '100vh', backgroundColor: '#F5F0E8' }}>
            <HeaderCompact />
            <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
                {children}
            </Box>
        </Box>
    );
}