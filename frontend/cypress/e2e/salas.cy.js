describe('Gestão de Salas', () => {

  beforeEach(() => {
    cy.login('/salas')
  })

  it('1. - mostra o título da página', () => {
    cy.contains('Gestão de Salas').should('exist')
  })

  it('2. - mostra o formulário de criação', () => {
    cy.contains('Criar Nova Sala').should('exist')
    cy.get('input[name="nome"]').should('exist')
    cy.get('input[name="capacidade"]').should('exist')
    cy.get('input[name="precoHora"]').should('exist')
  })

  it('3. - cria uma sala com sucesso', () => {
    const nomeSala = `Sala Cypress Test ${Date.now()}`
    cy.get('input[name="nome"]').type(nomeSala)
    cy.get('input[name="capacidade"]').type('2')
    cy.get('input[name="precoHora"]').type('10')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Test')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Sala criada com sucesso!').should('exist')
    cy.contains(nomeSala).should('exist')
  })

  it('4. - mostra erro ao criar sala com nome duplicado', () => {
    cy.contains('Salas Registadas').should('exist')
    cy.get('[title="Editar sala"]').first().click()
    cy.contains('Editar Sala').should('exist')
    cy.get('input[name="nome"]').invoke('val').then((nomeExistente) => {
      cy.contains('Cancelar').click()
      cy.get('input[name="nome"]').type(nomeExistente)
      cy.get('input[name="capacidade"]').type('2')
      cy.get('input[name="precoHora"]').type('10')
      cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Test')
      cy.contains('BANHO').click()
      cy.contains('Criar Sala').click()
      cy.contains('Ja existe uma sala com o nome').should('exist')
    })
  })

  it('5. - mostra erro ao criar sala sem nome', () => {
    cy.get('input[name="capacidade"]').type('2')
    cy.get('input[name="precoHora"]').type('10')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Test')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Nome da sala é obrigatório.').should('exist')
  })

  it('6. - mostra erro ao criar sala sem capacidade', () => {
    const nomeSala = `Sala Cypress Test ${Date.now()}`
    cy.get('input[name="nome"]').type(nomeSala)
    cy.get('input[name="precoHora"]').type('10')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Test')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Capacidade deve ser um número positivo maior que zero.').should('exist')
  })

  it('7. - mostra erro ao criar sala com capacidade 0', () => {
    const nomeSala = `Sala Cypress Test ${Date.now()}`
    cy.get('input[name="nome"]').type(nomeSala)
    cy.get('input[name="capacidade"]').type('0')
    cy.get('input[name="precoHora"]').type('10')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Test')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Capacidade deve ser um número positivo maior que zero.').should('exist')
  })

  it('8. - mostra erro ao criar sala com capacidade negativa', () => {
    const nomeSala = `Sala Cypress Test ${Date.now()}`
    cy.get('input[name="nome"]').type(nomeSala)
    cy.get('input[name="capacidade"]').type('-1')
    cy.get('input[name="precoHora"]').type('10')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Test')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Capacidade deve ser um número positivo maior que zero.').should('exist')
  })

  it('9. - mostra erro ao criar sala sem preço', () => {
    const nomeSala = `Sala Cypress Test ${Date.now()}`
    cy.get('input[name="nome"]').type(nomeSala)
    cy.get('input[name="capacidade"]').type('2')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Test')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Preço por hora deve ser um valor positivo maior que zero.').should('exist')
  })

  it('10. - mostra erro ao criar sala com preço 0', () => {
    const nomeSala = `Sala Cypress Test ${Date.now()}`
    cy.get('input[name="nome"]').type(nomeSala)
    cy.get('input[name="capacidade"]').type('2')
    cy.get('input[name="precoHora"]').type('0')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Test')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Preço por hora deve ser um valor positivo maior que zero.').should('exist')
  })

  it('11. - mostra erro ao criar sala com preço negativo', () => {
    const nomeSala = `Sala Cypress Test ${Date.now()}`
    cy.get('input[name="nome"]').type(nomeSala)
    cy.get('input[name="capacidade"]').type('2')
    cy.get('input[name="precoHora"]').type('-1')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Test')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Preço por hora deve ser um valor positivo maior que zero.').should('exist')
  })

  it('12. - mostra erro ao criar sala sem equipamento', () => {
    const nomeSala = `Sala Cypress Test ${Date.now()}`
    cy.get('input[name="nome"]').type(nomeSala)
    cy.get('input[name="capacidade"]').type('2')
    cy.get('input[name="precoHora"]').type('10')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Equipamento é obrigatório.').should('exist')
  })

  it('13. - mostra erro ao criar sala sem serviço', () => {
    const nomeSala = `Sala Cypress Test ${Date.now()}`
    cy.get('input[name="nome"]').type(nomeSala)
    cy.get('input[name="capacidade"]').type('2')
    cy.get('input[name="precoHora"]').type('10')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Test')
    cy.contains('Criar Sala').click()
    cy.contains('Selecione pelo menos um serviço para a sala.').should('exist')
  })

  it('14. - edita uma sala existente', () => {
    cy.contains('Salas Registadas').should('exist')
    cy.get('[title="Editar sala"]').first().click()
    cy.contains('Editar Sala').should('exist')
    cy.get('input[name="nome"]').clear().type(`Sala Cypress Editada ${Date.now()}`)
    cy.contains('Atualizar Sala').click()
    cy.contains('Sala atualizada com sucesso!').should('exist')
  })

  it('15. - cancela a edição de uma sala', () => {
    cy.contains('Salas Registadas').should('exist')
    cy.get('[title="Editar sala"]').first().click()
    cy.contains('Editar Sala').should('exist')
    cy.get('input[name="nome"]').clear().type('Nome Que Não Deve Ficar')
    cy.contains('Cancelar').click()
    cy.contains('Criar Nova Sala').should('exist')
    cy.contains('Nome Que Não Deve Ficar').should('not.exist')
  })

  it('16. - inativa uma sala existente', () => {
    cy.get('input[name="nome"]').type('Sala Cypress Inativar')
    cy.get('input[name="capacidade"]').type('1')
    cy.get('input[name="precoHora"]').type('5')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Teste')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Sala criada com sucesso!').should('exist')
    // Inativa a sala
    cy.contains('Sala Cypress Inativar').closest('.MuiPaper-outlined').find('[title="Inativar sala"]').click({ force: true })
    cy.contains('Inativar Sala').should('exist')
    cy.get('[data-testid="confirm-dialog-confirm"]').click()
    cy.contains('inativada com sucesso!').should('exist')
  })

  it('17. - cancela a inativação de uma sala', () => {
    cy.get('input[name="nome"]').type('Sala Cypress Cancelar Inativar')
    cy.get('input[name="capacidade"]').type('1')
    cy.get('input[name="precoHora"]').type('5')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Teste')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Sala criada com sucesso!').should('exist')
    // Tenta inativar mas cancela
    cy.contains('Sala Cypress Cancelar Inativar').closest('.MuiPaper-outlined').scrollIntoView().find('[title="Inativar sala"]').click({ force: true })
    cy.contains('Inativar Sala').should('exist')
    cy.contains('Cancelar').click({ force: true })
    cy.contains('Inativar Sala').should('not.exist')
  })

  it('18. - reativa uma sala inativa', () => {
    cy.get('input[name="nome"]').type('Sala Cypress Reativar')
    cy.get('input[name="capacidade"]').type('1')
    cy.get('input[name="precoHora"]').type('5')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Teste')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Sala criada com sucesso!').should('exist')
    // Inativa
    cy.contains('Sala Cypress Reativar').closest('.MuiPaper-outlined').find('[title="Inativar sala"]').click({ force: true })
    cy.get('[data-testid="confirm-dialog-confirm"]').click()
    cy.contains('inativada com sucesso!').should('exist')
    // Reativa
    cy.contains('Sala Cypress Reativar').closest('.MuiPaper-outlined').find('[title="Editar sala"]').click({ force: true })
    cy.contains('Sala Inativa').should('exist')
    cy.contains('Reativar Sala').click()
    cy.contains('Sala reativada com sucesso!').should('exist')
  })

  it('19. - cancela a reativação de uma sala', () => {
    cy.get('input[name="nome"]').type('Sala Cypress Cancelar Reativar')
    cy.get('input[name="capacidade"]').type('1')
    cy.get('input[name="precoHora"]').type('5')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Teste')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Sala criada com sucesso!').should('exist')
    // Inativa
    cy.contains('Sala Cypress Cancelar Reativar').closest('.MuiPaper-outlined').find('[title="Inativar sala"]').click({ force: true })
    cy.get('[data-testid="confirm-dialog-confirm"]').click()
    cy.contains('inativada com sucesso!').should('exist')
    // Tenta reativar mas cancela
    cy.contains('Sala Cypress Cancelar Reativar').closest('.MuiPaper-outlined').find('[title="Editar sala"]').click({ force: true })
    cy.contains('Sala Inativa').should('exist')
    cy.contains('Cancelar').click()
    cy.contains('Criar Nova Sala').should('exist')
  })

  it('20. - navega para detalhes da primeira sala da lista', () => {
    cy.contains('Salas Registadas').should('exist')
    cy.get('.MuiPaper-outlined').first().click()
    cy.url().should('include', '/salas/')
    cy.contains('Disponibilidade').should('exist')
  })

  it('21. - navega para detalhes de uma sala criada', () => {
    cy.get('input[name="nome"]').type('Sala Cypress Detalhes')
    cy.get('input[name="capacidade"]').type('1')
    cy.get('input[name="precoHora"]').type('5')
    cy.get('textarea[name="equipamento"]').type('Equipamento Cypress Teste')
    cy.contains('BANHO').click()
    cy.contains('Criar Sala').click()
    cy.contains('Sala criada com sucesso!').should('exist')
    // Navega para os detalhes da sala criada
    cy.contains('Sala Cypress Detalhes').closest('.MuiPaper-outlined').scrollIntoView().click()
    cy.url().should('include', '/salas/')
    cy.contains('Disponibilidade').should('exist')
  })

  // Limpa as salas criadas pelos testes
  after(() => {
    cy.request('DELETE', 'http://localhost:5000/test/salas-cypress')
  })
})