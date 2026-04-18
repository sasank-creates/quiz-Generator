import axios from 'axios';

const Backend_config = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080', // dynamically reads from env
});
export default Backend_config;