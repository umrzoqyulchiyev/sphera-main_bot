#!/bin/bash
# ============================================================
#  Loyihani 24/7 SERVER rejimiga sozlaydi (sudo kerak — BIR MARTA)
#  Ishlatish:  sudo bash infra/systemd/setup-always-on.sh
#
#  Bu script:
#   1. Uxlash/hibernate'ni butunlay o'chiradi (kompyuter uxlamaydi)
#   2. Noutbuk qopqog'i yopilganda ham ishlashda davom etadi
#   3. linger — login bo'lmasa ham xizmatlar ishlaydi
#   4. Postgres/Redis autostart
# ============================================================
set -e
USER_NAME="${SUDO_USER:-umrzoq}"

echo "[1/5] Uxlash/hibernate butunlay o'chirilmoqda..."
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

echo "[2/5] Noutbuk qopqog'i yopilganda uxlamasin (ignore)..."
sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/' /etc/systemd/logind.conf
sed -i 's/^#\?HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/' /etc/systemd/logind.conf
sed -i 's/^#\?HandleLidSwitchDocked=.*/HandleLidSwitchDocked=ignore/' /etc/systemd/logind.conf
# logind config yangi yozuvlarsiz bo'lsa qo'shamiz
grep -q "^HandleLidSwitch=" /etc/systemd/logind.conf || echo "HandleLidSwitch=ignore" >> /etc/systemd/logind.conf
systemctl restart systemd-logind || true

echo "[3/5] Foydalanuvchi xizmatlari login'siz ishlashi uchun linger..."
loginctl enable-linger "$USER_NAME"

echo "[4/5] Postgres va Redis boot'da avto-ishga tushsin..."
systemctl enable postgresql 2>/dev/null || true
systemctl enable redis-server 2>/dev/null || systemctl enable redis 2>/dev/null || true

echo "[5/5] GNOME idle-sleep o'chirilmoqda..."
sudo -u "$USER_NAME" DISPLAY=:0 dbus-launch gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing' 2>/dev/null || true
sudo -u "$USER_NAME" DISPLAY=:0 dbus-launch gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-battery-type 'nothing' 2>/dev/null || true

echo ""
echo "✅ TAYYOR! Kompyuter endi server kabi ishlaydi:"
echo "   • Uxlamaydi (sleep/suspend o'chirilgan)"
echo "   • Qopqoq yopilsa ham ishlaydi"
echo "   • O'chib-yonsa hamma xizmat o'zi tiklanadi"
echo ""
echo "Tekshirish: systemctl --user status sphera-backend sphera-bot sphera-tunnel sphera-icecast"
