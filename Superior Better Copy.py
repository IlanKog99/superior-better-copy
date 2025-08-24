import time, re, threading, pyautogui, pyperclip, keyboard
import customtkinter as ctk
import win32api, win32con
from typing import Optional


class ToastNotification:
    
    def __init__(self, message: str, duration: int = 1000):
        self.message = message
        self.duration = duration
        self.toasts = []
    
    def _create_toast(self, geometry: str) -> ctk.CTkToplevel:
        toast = ctk.CTkToplevel()
        toast.overrideredirect(True)
        toast.attributes("-topmost", True)
        toast.geometry(geometry)
        
        label = ctk.CTkLabel(toast, text=self.message)
        label.pack(expand=True, fill="both", padx=10, pady=10)
        
        return toast
    
    def show(self):
        positions = [
            "100x50-1010+900",
            "100x50+910+900",
            "100x50+2830+980"
        ]
        
        for position in positions:
            toast = self._create_toast(position)
            self.toasts.append(toast)
            toast.after(self.duration, toast.destroy)


def show_quick_toast(message: str = "Task finished", duration: int = 1000):
    toast = ToastNotification(message, duration)
    toast.show()


class SuperiorBetterCopyApp(ctk.CTk):

    def __init__(self) -> None:
        super().__init__()
        self.title("Superior Better Copy - v0.2.4")
        self.geometry("500x650")
        ctk.set_appearance_mode("Dark")
        ctk.set_default_color_theme("dark-blue")

        self.hwnd = self.winfo_id()

        self.typing_speed: float = 0.01
        self.typing_thread: Optional[threading.Thread] = None
        self.stop_typing_flag: bool = False
        self.last_typed_char: Optional[str] = None
        self.ignore_mode: bool = True
        self.start_delay: float = 2.0

        self._setup_widgets()
        
        keyboard.add_hotkey('ctrl+f7', self.start_typing_from_clipboard)
        keyboard.add_hotkey('ctrl+shift+f7', self.start_typing_immediately_from_clipboard)

    def _setup_widgets(self) -> None:
        self.tab_view: ctk.CTkTabview = ctk.CTkTabview(self, height=120)
        self.tab_view.pack(pady=5, padx=20, fill="x")
        
        self.help_tab = self.tab_view.add("Help")
        self.help_label: ctk.CTkLabel = ctk.CTkLabel(
            self.help_tab, 
            text="Special features:\n• [backspace] - Press backspace\n• [enter] - Press enter key\n• [arrow up/left/right/down] - Arrow keys\n• [delay 2.5] - Wait 2.5 seconds\n• [ctrl+c] - Press Ctrl+C\n• [shift+tab] - Press Shift+Tab",
            font=("Arial", 14),
            text_color="#B0E0E6"
        )
        self.help_label.pack(pady=10, padx=10)
        
        self.buttons_tab = self.tab_view.add("Buttons")
        
        self.special_buttons_frame: ctk.CTkFrame = ctk.CTkFrame(self.buttons_tab)
        self.special_buttons_frame.pack(pady=10, padx=10, fill="x")
        
        self.tab_button: ctk.CTkButton = ctk.CTkButton(
            self.special_buttons_frame,
            text="Tab",
            command=self._insert_tab,
            font=("Arial", 12, "bold"),
            fg_color="#1f538d",
            hover_color="#14375e",
            text_color="#FFFFFF",
            width=80
        )
        self.tab_button.pack(side="left", padx=5, pady=5)
        
        self.shift_button: ctk.CTkButton = ctk.CTkButton(
            self.special_buttons_frame,
            text="Shift",
            command=self._insert_shift,
            font=("Arial", 12, "bold"),
            fg_color="#1f538d",
            hover_color="#14375e",
            text_color="#FFFFFF",
            width=80
        )
        self.shift_button.pack(side="left", padx=5, pady=5)
        
        self.ctrl_button: ctk.CTkButton = ctk.CTkButton(
            self.special_buttons_frame,
            text="Ctrl",
            command=self._insert_ctrl,
            font=("Arial", 12, "bold"),
            fg_color="#1f538d",
            hover_color="#14375e",
            text_color="#FFFFFF",
            width=80
        )
        self.ctrl_button.pack(side="left", padx=5, pady=5)
        
        self.enter_button: ctk.CTkButton = ctk.CTkButton(
            self.special_buttons_frame,
            text="Enter",
            command=self._insert_enter,
            font=("Arial", 12, "bold"),
            fg_color="#1f538d",
            hover_color="#14375e",
            text_color="#FFFFFF",
            width=80
        )
        self.enter_button.pack(side="left", padx=5, pady=5)
        
        self.sergei_button: ctk.CTkButton = ctk.CTkButton(
            self.special_buttons_frame,
            text="Sergei",
            command=self._insert_sergei,
            font=("Arial", 12, "bold"),
            fg_color="#1f538d",
            hover_color="#14375e",
            text_color="#FFFFFF",
            width=80
        )
        self.sergei_button.pack(side="left", padx=5, pady=5)

        self.settings_frame: ctk.CTkFrame = ctk.CTkFrame(self)
        self.settings_frame.pack(pady=5, padx=20, fill="x")
        
        self.ignore_checkbox: ctk.CTkCheckBox = ctk.CTkCheckBox(
            self.settings_frame,
            text="Ignore mode (type brackets as text)",
            command=self._toggle_ignore_mode,
            font=("Arial", 12),
            text_color="#B0E0E6"
        )
        self.ignore_checkbox.pack(side="left", padx=10, pady=5)
        self.ignore_checkbox.select()
        
        self.delay_frame: ctk.CTkFrame = ctk.CTkFrame(self.settings_frame)
        self.delay_frame.pack(side="right", padx=10, pady=5)
        
        self.delay_label: ctk.CTkLabel = ctk.CTkLabel(
            self.delay_frame,
            text="Start Delay (seconds):",
            font=("Arial", 12),
            text_color="#B0E0E6"
        )
        self.delay_label.pack(side="left", padx=5, pady=5)
        
        self.delay_entry: ctk.CTkEntry = ctk.CTkEntry(
            self.delay_frame,
            width=80,
            placeholder_text="2.0",
            font=("Arial", 12)
        )
        self.delay_entry.pack(side="right", padx=5, pady=5)
        self.delay_entry.insert(0, "2.0")

        self.text_box: ctk.CTkTextbox = ctk.CTkTextbox(
            self, 
            width=450, 
            height=250, 
            font=("Arial", 22)
        )
        self.text_box.pack(pady=10)

        self.button_frame: ctk.CTkFrame = ctk.CTkFrame(self)
        self.button_frame.pack(pady=10)

        self.start_button: ctk.CTkButton = ctk.CTkButton(
            self.button_frame, 
            text="Start Typing (Ctrl+F7)", 
            command=self.start_typing, 
            font=("Arial", 14, "bold"),
            fg_color="#00B4B4",
            hover_color="#00D4D4",
            text_color="#FFFFFF",
            width=200
        )
        self.start_button.pack(side="left", padx=5)

        self.start_immediately_button: ctk.CTkButton = ctk.CTkButton(
            self.button_frame, 
            text="Start Immediately (Ctrl+Shift+F7)", 
            command=self.start_typing_immediately, 
            font=("Arial", 14, "bold"),
            fg_color="#00B4B4",
            hover_color="#00D4D4",
            text_color="#FFFFFF",
            width=200
        )
        self.start_immediately_button.pack(side="right", padx=5)

        self.stop_button: ctk.CTkButton = ctk.CTkButton(
            self, 
            text="Stop Typing", 
            command=self.stop_typing, 
            font=("Arial", 14, "bold"),
            fg_color="#008080",
            hover_color="#00A0A0",
            text_color="#FFFFFF"
        )
        self.stop_button.pack(pady=5)

    def _toggle_ignore_mode(self) -> None:
        self.ignore_mode = self.ignore_checkbox.get()

    def _insert_tab(self) -> None:
        self.text_box.insert("insert", "[tab]")

    def _insert_shift(self) -> None:
        self.text_box.insert("insert", "[shift+]")

    def _insert_ctrl(self) -> None:
        self.text_box.insert("insert", "[ctrl+]")

    def _insert_enter(self) -> None:
        self.text_box.insert("insert", "[enter]")

    def _insert_sergei(self) -> None:
        self.text_box.insert("insert", "[Thank you so much for your help!!!]")

    def _get_delay_value(self) -> float:
        try:
            delay_text = self.delay_entry.get().strip()
            if not delay_text:
                return 2.0
            delay_value = float(delay_text)
            if delay_value < 0:
                return 0.0
            return delay_value
        except ValueError:
            self.delay_entry.delete(0, "end")
            self.delay_entry.insert(0, "2.0")
            return 2.0

    def start_typing(self) -> None:
        if self.typing_thread and self.typing_thread.is_alive():
            return

        self.stop_typing_flag = False
        text: str = self.text_box.get("0.0", "end-1c")
        self.typing_thread = threading.Thread(target=self._type_text, args=(text,))
        self.typing_thread.start()

    def start_typing_from_clipboard(self) -> None:
        try:
            clipboard_text: str = pyperclip.paste()
            if clipboard_text.strip():
                self.text_box.delete("0.0", "end")
                self.text_box.insert("0.0", clipboard_text)
                self.start_typing()
        except Exception as e:
            print(f"Error accessing clipboard: {e}")

    def start_typing_immediately(self) -> None:
        if self.typing_thread and self.typing_thread.is_alive():
            return

        self.stop_typing_flag = False
        text: str = self.text_box.get("0.0", "end-1c")
        self.typing_thread = threading.Thread(target=self._type_text_immediately, args=(text,))
        self.typing_thread.start()

    def start_typing_immediately_from_clipboard(self) -> None:
        try:
            clipboard_text: str = pyperclip.paste()
            if clipboard_text.strip():
                self.text_box.delete("0.0", "end")
                self.text_box.insert("0.0", clipboard_text)
                self.start_typing_immediately()
        except Exception as e:
            print(f"Error accessing clipboard: {e}")

    def stop_typing(self) -> None:
        self.stop_typing_flag = True

    def _type_text(self, text: str) -> None:
        delay_seconds = self._get_delay_value()
        time.sleep(delay_seconds)
        
        pattern: re.Pattern = re.compile(r'\[(.*?)\]')
        index: int = 0
        
        while index < len(text):
            if self.stop_typing_flag:
                break
                
            if text[index] == '[':
                match: Optional[re.Match] = pattern.match(text, index)
                if match:
                    combo_text: str = match.group(1).lower()
                    
                    if self.ignore_mode:
                        for char in match.group(0):
                            if self.stop_typing_flag:
                                break
                            self._type_character(char)
                        index += len(match.group(0))
                        continue
                    
                    if combo_text == 'backspace':
                        pyautogui.press('backspace')
                        self.last_typed_char = None
                    elif combo_text == 'enter':
                        pyautogui.press('enter')
                        self.last_typed_char = '\n'
                    elif combo_text.startswith('arrow '):
                        direction = combo_text[6:].lower()
                        if direction in ['up', 'down', 'left', 'right']:
                            pyautogui.press(direction)
                        self.last_typed_char = None
                    elif combo_text.startswith('delay'):
                        try:
                            if combo_text == 'delay':
                                time.sleep(0.5)
                            else:
                                delay_seconds: float = float(combo_text.split(' ')[1])
                                time.sleep(delay_seconds)
                        except (IndexError, ValueError):
                            time.sleep(1)
                        self.last_typed_char = None
                    else:
                        combo: list[str] = combo_text.split('+')
                        for key in combo:
                            pyautogui.keyDown(key.strip())
                        for key in reversed(combo):
                            pyautogui.keyUp(key.strip())
                        self.last_typed_char = None
                    
                    index += len(match.group(0))
                    continue
            
            char: str = text[index]
            self._type_character(char)
            index += 1
        
        if not self.stop_typing_flag:
            self.after(0, lambda: show_quick_toast("Task Finished!", 1000))

    def _type_text_immediately(self, text: str) -> None:
        pattern: re.Pattern = re.compile(r'\[(.*?)\]')
        index: int = 0
        
        while index < len(text):
            if self.stop_typing_flag:
                break
                
            if text[index] == '[':
                match: Optional[re.Match] = pattern.match(text, index)
                if match:
                    combo_text: str = match.group(1).lower()
                    
                    if self.ignore_mode:
                        for char in match.group(0):
                            if self.stop_typing_flag:
                                break
                            self._type_character(char)
                        index += len(match.group(0))
                        continue
                    
                    if combo_text == 'backspace':
                        pyautogui.press('backspace')
                        self.last_typed_char = None
                    elif combo_text == 'enter':
                        pyautogui.press('enter')
                        self.last_typed_char = '\n'
                    elif combo_text.startswith('arrow '):
                        direction = combo_text[6:].lower()
                        if direction in ['up', 'down', 'left', 'right']:
                            pyautogui.press(direction)
                        self.last_typed_char = None
                    elif combo_text.startswith('delay'):
                        try:
                            if combo_text == 'delay':
                                time.sleep(0.5)
                            else:
                                delay_seconds: float = float(combo_text.split(' ')[1])
                                time.sleep(delay_seconds)
                        except (IndexError, ValueError):
                            time.sleep(1)
                        self.last_typed_char = None
                    else:
                        combo: list[str] = combo_text.split('+')
                        for key in combo:
                            pyautogui.keyDown(key.strip())
                        for key in reversed(combo):
                            pyautogui.keyUp(key.strip())
                        self.last_typed_char = None
                    
                    index += len(match.group(0))
                    continue
            
            char: str = text[index]
            self._type_character(char)
            index += 1
        
        if not self.stop_typing_flag:
            self.after(0, lambda: show_quick_toast("Task Finished!", 1000))

    def _type_character(self, char: str) -> None:
        if char == '\n':
            pyautogui.press('enter')
        elif char == '\t':
            pyautogui.press('tab')
        elif char == ' ':
            pyautogui.press('space')
            self.last_typed_char = ' '
        elif char.isalpha():
            if char.isupper():
                win32api.keybd_event(win32con.VK_SHIFT, 0, 0, 0)
                win32api.keybd_event(0x41 + ord(char.lower()) - ord('a'), 0, 0, 0)
                win32api.keybd_event(0x41 + ord(char.lower()) - ord('a'), 0, win32con.KEYEVENTF_KEYUP, 0)
                win32api.keybd_event(win32con.VK_SHIFT, 0, win32con.KEYEVENTF_KEYUP, 0)
            else:
                win32api.keybd_event(0x41 + ord(char) - ord('a'), 0, 0, 0)
                win32api.keybd_event(0x41 + ord(char) - ord('a'), 0, win32con.KEYEVENTF_KEYUP, 0)
            self.last_typed_char = char
        else:
            pyautogui.typewrite(char)
        
        if self.typing_speed > 0:
            time.sleep(self.typing_speed / 1000)


if __name__ == "__main__":
    app: SuperiorBetterCopyApp = SuperiorBetterCopyApp()
    app.mainloop()
