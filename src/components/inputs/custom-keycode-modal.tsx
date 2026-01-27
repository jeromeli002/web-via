import {useState, useMemo} from 'react';
import styled from 'styled-components';
import {AccentButton, PrimaryAccentButton} from './accent-button';
import {AutocompleteItem} from './autocomplete-keycode';
import {
  anyKeycodeToString,
  advancedStringToKeycode,
} from '../../utils/advanced-keys';
import {useCombobox} from 'downshift';
import TextInput from './text-input';
import {getKeycodesForKeyboard} from '../../utils/key'; // IKeycode 类型在原代码未导出时可省略或从同路径导入
import {useAppSelector} from 'src/store/hooks';
import {
  getBasicKeyToByte,
  getSelectedDefinition,
} from 'src/store/definitionsSlice';
import {
  ModalBackground,
  ModalContainer,
  PromptText,
  RowDiv,
} from './dialog-base';
import {useTranslation} from 'react-i18next';

// --- 样式定义 ---

const AutocompleteContainer = styled.ul`
  position: fixed;
  background-color: var(--bg_menu);
  max-height: 210px;
  overflow: auto;
  border: 1px solid var(--bg_control);
  margin: 0;
  padding: 0;
  width: auto;
  margin-top: -24px;
  line-height: normal;
  z-index: 1001; /* 提升层级，防止被遮挡 */
`;

const AutocompleteItemRow = styled.li`
  &:not(:last-child) {
    border-bottom: 1px solid var(--bg_control);
  }
`;

// 新增：修饰键容器样式
const ModifierContainer = styled.div`
  margin: 10px 0;
  padding: 10px;
  border: 1px solid var(--border_color_icon);
  border-radius: 4px;
  color: var(--color_label);
`;

const ModifierRow = styled.div`
  display: flex;
  align-items: center;
  margin: 5px 0;
  flex-wrap: wrap;
`;

const ModifierCheckbox = styled.input`
  margin-right: 8px;
  accent-color: var(--color_accent);
`;

const ModifierLabel = styled.label`
  margin-right: 15px;
  display: flex;
  align-items: center;
  margin-bottom: 5px;
  color: var(--color_label);
  font-weight: normal;
  cursor: pointer;
`;

const SideSelector = styled.div`
  margin-left: 20px;
  display: flex;
  gap: 10px;
`;

const ModifierTitle = styled.div`
  font-weight: bold;
  margin-bottom: 8px;
  color: var(--color_label-highlighted);
`;

const ModifierSubtitle = styled.div`
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 14px;
  color: var(--color_label);
`;

// 新增：Hex 预览样式
const HexDisplay = styled.div`
  margin: 10px 0;
  padding: 8px;
  background-color: var(--bg_control);
  border-radius: 4px;
  font-family: monospace;
  color: var(--color_label);
  text-align: center;
  font-size: 14px;
`;

// --- 类型与逻辑 ---

type KeycodeModalProps = {
  defaultValue?: number;
  onChange?: (val: number) => void;
  onExit: () => void;
  onConfirm: (keycode: number) => void;
};

interface ModifierState {
  enabled: boolean;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  gui: boolean;
  useRight: boolean;
}

// 核心逻辑：生成组合键字符串 (例如 LCTL(KC_A))
const generateModifiedKeycode = (
  baseKeycode: string,
  modifiers: ModifierState,
): string => {
  if (!modifiers.enabled || !baseKeycode || baseKeycode === 'KC_NO' || baseKeycode === 'KC_TRNS') {
    return baseKeycode;
  }

  const modParts: string[] = [];
  if (modifiers.shift) modParts.push(modifiers.useRight ? 'RSFT' : 'LSFT');
  if (modifiers.ctrl) modParts.push(modifiers.useRight ? 'RCTL' : 'LCTL');
  if (modifiers.alt) modParts.push(modifiers.useRight ? 'RALT' : 'LALT');
  if (modifiers.gui) modParts.push(modifiers.useRight ? 'RGUI' : 'LGUI');

  if (modParts.length === 0) return baseKeycode;
  if (modParts.length === 1) return `${modParts[0]}(${baseKeycode})`;

  // 递归包裹: MOD1(MOD2(KEY))
  return modParts.join('(') + '(' + baseKeycode + ')'.repeat(modParts.length);
};

// 验证工具函数
const isHex = (input: string) => /^0x[0-9a-f]{1,4}$/i.test(input.trim());
const inputIsBasicByte = (input: string, dict: Record<string, number>) => input.trim().toUpperCase() in dict;
const inputIsAdvanced = (input: string, dict: Record<string, number>) => advancedStringToKeycode(input.trim().toUpperCase(), dict) !== 0;

// 统一的键值获取函数
function keycodeFromInput(input: string, basicKeyToByte: Record<string, number>): number | null {
  const cleanInput = input.trim().toUpperCase();
  if (inputIsBasicByte(cleanInput, basicKeyToByte)) return basicKeyToByte[cleanInput];
  if (inputIsAdvanced(cleanInput, basicKeyToByte)) return advancedStringToKeycode(cleanInput, basicKeyToByte);
  if (isHex(cleanInput)) return parseInt(cleanInput, 16);
  return null;
}

// --- 组件定义 ---

export const KeycodeModal: React.FC<KeycodeModalProps> = (props) => {
  const {t} = useTranslation();
  const selectedDefinition = useAppSelector(getSelectedDefinition);
  const {basicKeyToByte, byteToKey} = useAppSelector(getBasicKeyToByte);

  // 1. 修饰键状态管理
  const [modifiers, setModifiers] = useState<ModifierState>({
    enabled: false,
    shift: false,
    ctrl: false,
    alt: false,
    gui: false,
    useRight: false,
  });

  // 2. 数据源优化：合并基础键和定义键，并缓存结果
  const supportedInputItems = useMemo(() => {
    // 获取基础键 (KC_A, KC_1 等)
    const basicItems = Object.keys(basicKeyToByte).map(code => ({
      code: code,
      label: code,
    }));

    // 获取当前键盘特定的键 (如特殊宏、灯光键)
    const definitionItems = selectedDefinition 
      ? getKeycodesForKeyboard(selectedDefinition).map(k => ({
          code: k.code,
          label: k.title ?? k.name,
        }))
      : [];

    // 合并并去重
    const combined = [...basicItems, ...definitionItems];
    const uniqueMap = new Map();
    combined.forEach(item => uniqueMap.set(item.code, item));
    return Array.from(uniqueMap.values());
  }, [selectedDefinition, basicKeyToByte]);

  const [inputItems, setInputItems] = useState(supportedInputItems);
  
  // 转换默认值为字符串
  const defaultInput = anyKeycodeToString(
    props.defaultValue as number,
    basicKeyToByte,
    byteToKey,
  );

  // 3. Downshift 自动补全逻辑
  const {
    getMenuProps,
    getInputProps,
    highlightedIndex,
    inputValue,
    getItemProps,
    isOpen,
  } = useCombobox({
    items: inputItems,
    initialIsOpen: false,
    defaultInputValue: defaultInput,
    itemToString: (item) => item?.code ?? '',
    onInputValueChange: ({inputValue}) => {
      const search = (inputValue ?? '').toLowerCase();
      setInputItems(
        supportedInputItems.filter(({label, code}) => 
          label.toLowerCase().includes(search) || code.toLowerCase().includes(search)
        ).slice(0, 100) // 性能优化：限制列表显示数量
      );
    },
  });

  // 获取结合了修饰键的最终字符串
  const getFinalKeycode = (input: string): string => {
    const cleanInput = input.trim().toUpperCase();
    if (!cleanInput) return 'KC_NO';
    return generateModifiedKeycode(cleanInput, modifiers);
  };

  // 生成 Hex 预览文字
  const getHexDisplay = (input: string): string => {
    const finalKeycode = getFinalKeycode(input);
    const byteValue = keycodeFromInput(finalKeycode, basicKeyToByte);
    return byteValue !== null 
      ? `0x${byteValue.toString(16).toUpperCase().padStart(4, '0')}`
      : 'Invalid';
  };

  // 实时校验合法性
  const finalStr = getFinalKeycode(inputValue as string);
  const isValid = keycodeFromInput(finalStr, basicKeyToByte) !== null;

  const handleModifierChange = (modifier: keyof ModifierState) => {
    setModifiers(prev => ({ ...prev, [modifier]: !prev[modifier] }));
  };

  if (!selectedDefinition) {
    return null;
  }

  return (
    <ModalBackground>
      <ModalContainer>
        <PromptText>
          {t('Please enter your desired QMK keycode or hex code:')}
        </PromptText>
        
        {/* 修饰键选择区域 */}
        <ModifierContainer>
          <ModifierTitle>
            <ModifierLabel>
              <ModifierCheckbox 
                type="checkbox" 
                checked={modifiers.enabled} 
                onChange={() => handleModifierChange('enabled')} 
              />
              {t('Enable Modifiers')}
            </ModifierLabel>
          </ModifierTitle>
          
          {modifiers.enabled && (
            <>
              <ModifierSubtitle>{t('Modifiers')}</ModifierSubtitle>
              <ModifierRow>
                {['shift', 'ctrl', 'alt', 'gui'].map((mod) => (
                  <ModifierLabel key={mod}>
                    <ModifierCheckbox 
                      type="checkbox" 
                      checked={(modifiers as any)[mod]} 
                      onChange={() => handleModifierChange(mod as any)} 
                    />
                    {mod.toUpperCase()}
                  </ModifierLabel>
                ))}
                <SideSelector>
                  <ModifierLabel>
                    <ModifierCheckbox 
                      type="radio" 
                      name="side" 
                      checked={!modifiers.useRight} 
                      onChange={() => setModifiers(prev => ({ ...prev, useRight: false }))} 
                    />
                    Left
                  </ModifierLabel>
                  <ModifierLabel>
                    <ModifierCheckbox 
                      type="radio" 
                      name="side" 
                      checked={modifiers.useRight} 
                      onChange={() => setModifiers(prev => ({ ...prev, useRight: true }))} 
                    />
                    Right
                  </ModifierLabel>
                </SideSelector>
              </ModifierRow>
            </>
          )}
        </ModifierContainer>

        {/* 输入框与自动补全 */}
        <div style={{position: 'relative'}}>
          <TextInput
            {...getInputProps()}
            type="text"
            placeholder={defaultInput || 'KC_NO, 0xFF, etc.'}
          />
          
          {/* 新增：十六进制代码预览 */}
          <HexDisplay>
            {t('Hex code:')} {getHexDisplay(inputValue as string)}
          </HexDisplay>
          
          <AutocompleteContainer
            {...getMenuProps()}
            style={{
              display: isOpen && inputItems.length ? 'block' : 'none',
            }}
          >
            {isOpen &&
              inputItems.map((item, index) => (
                <AutocompleteItemRow
                  {...getItemProps({item, index})}
                  key={`${item.code}-${index}`}
                >
                  <AutocompleteItem
                    selected={highlightedIndex === index}
                    entity={item}
                  />
                </AutocompleteItemRow>
              ))}
          </AutocompleteContainer>
        </div>

        <RowDiv>
          <AccentButton onClick={props.onExit}>{t('Cancel')}</AccentButton>
          <PrimaryAccentButton
            disabled={!isValid}
            onClick={() => {
              const byteValue = keycodeFromInput(finalStr, basicKeyToByte);
              if (byteValue !== null) {
                props.onConfirm(byteValue);
              }
            }}
          >
            {t('Confirm')}
          </PrimaryAccentButton>
        </RowDiv>
      </ModalContainer>
    </ModalBackground>
  );
};