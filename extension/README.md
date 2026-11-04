# Bench Boss ESPN Sync

1. Unzip this folder.
2. Open `chrome://extensions` in Chrome or Edge.
3. Enable **Developer mode**.
4. Choose **Load unpacked** and select this folder.
5. In Bench Boss, choose **Open ESPN & sync**, open the desired hockey league, and click **Connect to Bench Boss**.

The extension reads `espn_s2` and `SWID` only after the user clicks Connect. Credentials are handed back in the URL fragment, which is not sent in HTTP requests, and Bench Boss immediately removes the fragment after reading it.
