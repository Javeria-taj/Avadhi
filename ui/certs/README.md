# TLS certificates for the microphone

`getUserMedia` is blocked on non-secure origins. The phone opening
`http://192.168.x.x:3000` gets **no microphone and no error message**.

Generate certs for your actual LAN IP, then rename them here:

```bash
ipconfig getifaddr en0                              # note the IP
mkcert <that-ip> localhost 127.0.0.1
mv <that-ip>+2-key.pem  certs/key.pem
mv <that-ip>+2.pem      certs/cert.pem
npm run dev:https
```

Verify on the S24 before you need it: the mic permission prompt must appear.
Use the phone's own hotspot, not venue Wi-Fi.

`certs/*.pem` is gitignored.
