import ts from 'typescript-eslint';
import obsidian from 'eslint-plugin-obsidianmd';
import js from '@eslint/js';

export default ts.config(
 {ignores:['node_modules/**','dist/**','work/**','qa/**','tests/artifacts/**']},
 ...ts.configs.recommended,
 ...obsidian.configs.recommended.filter(c=>c.rules?.['obsidianmd/validate-manifest']||c.rules?.['obsidianmd/validate-license']),
 {files:['*.mjs','scripts/**/*.mjs'],rules:{...js.configs.recommended.rules,'no-undef':'off'}},
 {files:['src/**/*.ts'],plugins:{obsidianmd:obsidian},languageOptions:{parserOptions:{projectService:true}},rules:{...obsidian.ruleConfigs.recommended,...obsidian.ruleConfigs.recommendedTypeChecked}},
 {files:['**/*.ts'],rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_',caughtErrors:'none'}]}}
);
